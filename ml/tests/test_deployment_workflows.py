import re
import tomllib
from pathlib import Path

import yaml

REPOSITORY_ROOT = Path(__file__).parents[2]
WORKFLOWS = REPOSITORY_ROOT / ".github" / "workflows"
TASKFILE = REPOSITORY_ROOT / "Taskfile.yml"
GITLEAKS_CONFIG = REPOSITORY_ROOT / ".gitleaks.toml"
DEPENDABOT_CONFIG = REPOSITORY_ROOT / ".github" / "dependabot.yml"
PINNED_ACTION = re.compile(r"^[^\s@]+@[0-9a-f]{40}$")


def _workflow(name: str) -> tuple[dict, str]:
    source = (WORKFLOWS / name).read_text()
    return yaml.safe_load(source), source


def _uses_values(value: object) -> list[str]:
    if isinstance(value, dict):
        actions: list[str] = []
        for key, child in value.items():
            if key == "uses" and isinstance(child, str):
                actions.append(child)
            else:
                actions.extend(_uses_values(child))
        return actions
    if isinstance(value, list):
        return [item for child in value for item in _uses_values(child)]
    return []


def test_deployment_workflows_pin_every_third_party_action():
    for workflow_name in (
        "ci.yml",
        "terraform-plan.yml",
        "deploy.yml",
        "preview.yml",
        "unpublish.yml",
    ):
        workflow, _ = _workflow(workflow_name)
        for action in _uses_values(workflow):
            assert PINNED_ACTION.fullmatch(action), f"{workflow_name}: {action}"


def test_deployment_workflows_only_use_actions_allowed_by_repository_policy():
    for workflow_name in (
        "ci.yml",
        "terraform-plan.yml",
        "deploy.yml",
        "preview.yml",
        "unpublish.yml",
    ):
        workflow, _ = _workflow(workflow_name)
        for action in _uses_values(workflow):
            assert action.startswith("actions/"), f"{workflow_name}: {action}"


def test_plan_is_manual_read_only_and_never_applies():
    workflow, source = _workflow("terraform-plan.yml")

    assert set(workflow[True]) == {"workflow_dispatch"}
    assert workflow["permissions"] == {"contents": "read"}
    assert "terraform apply" not in source
    assert "pull_request_target" not in source


def test_deploy_is_manual_serialized_and_applies_a_saved_plan():
    workflow, source = _workflow("deploy.yml")

    assert set(workflow[True]) == {"workflow_dispatch"}
    assert workflow["permissions"] == {"contents": "read"}
    assert workflow["concurrency"]["cancel-in-progress"] is False
    assert "task deploy:check" in source
    assert re.search(r"terraform .* plan .* -out=\S+\.tfplan", source)
    assert "scripts/production_apply.py production.tfplan" in source
    assert "merge-base --is-ancestor" in source
    assert "terraform_backend.py backup production pre-apply" in source
    assert "terraform_backend.py backup production post-apply" in source
    assert "model_release_tag" not in source
    assert "Publish verified model artifacts" not in source
    assert "pull_request_target" not in source
    assert "scripts/install_ci_tools.sh terraform task gitleaks" in source
    assert "task model:smoke" in source


def test_ci_and_deploy_share_the_pinned_gitleaks_installer():
    _, ci_source = _workflow("ci.yml")
    installer = (REPOSITORY_ROOT / "scripts" / "install_ci_tools.sh").read_text()

    assert "scripts/install_ci_tools.sh gitleaks" in ci_source
    assert "gitleaks_version=" in installer
    assert "gitleaks_sha256=" in installer
    assert "gitleaks) install_gitleaks" in installer


def test_dependabot_checks_the_production_terraform_provider_weekly():
    config = yaml.safe_load(DEPENDABOT_CONFIG.read_text())
    terraform = next(
        update for update in config["updates"] if update["package-ecosystem"] == "terraform"
    )

    assert terraform["directory"] == "/infra/production"
    assert terraform["schedule"]["interval"] == "weekly"


def test_ci_runs_cross_browser_end_to_end_tests_for_web_changes():
    _, source = _workflow("ci.yml")

    assert "playwright install --with-deps chromium webkit" in source
    assert "npm run e2e" in source


def test_deploy_runs_real_model_end_to_end_tests_after_the_http_smoke():
    _, source = _workflow("deploy.yml")

    smoke = source.index("task deploy:smoke")
    browser_install = source.index("playwright install --with-deps chromium")
    production_e2e = source.index("task deploy:e2e")
    assert smoke < browser_install < production_e2e
    assert "VITE_E2E_FIXTURES" not in source


def test_task_deploy_dispatches_the_main_workflow_instead_of_applying_locally():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    source = "\n".join(taskfile["tasks"]["deploy"]["cmds"])

    assert "gh workflow run deploy.yml" in source
    assert "--ref main" in source
    assert "terraform apply" not in source


def test_end_to_end_tasks_separate_local_and_production_targets():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    local_source = "\n".join(taskfile["tasks"]["ui:e2e"]["cmds"])
    production_source = "\n".join(taskfile["tasks"]["deploy:e2e"]["cmds"])

    assert "npm run e2e" in local_source
    assert "npm run e2e:production" in production_source
    assert "E2E_PUBLIC_BASE_URL" in production_source


def test_unpublish_is_manual_serialized_and_removes_only_publication():
    workflow, source = _workflow("unpublish.yml")

    assert set(workflow[True]) == {"workflow_dispatch"}
    assert workflow["permissions"] == {"contents": "read"}
    assert workflow["concurrency"] == {
        "group": "production-deployment",
        "cancel-in-progress": False,
    }
    assert "unpublish ikimono-scan.app" in source
    assert "merge-base --is-ancestor" in source
    assert re.search(
        r"terraform .* plan .* -var=site_published=false .*out=\S+\.tfplan",
        source,
    )
    assert re.search(r"terraform .* apply .* \S+\.tfplan", source)
    assert "terraform_backend.py backup production pre-apply" in source
    assert "terraform_backend.py backup production post-apply" in source
    assert "task unpublish:smoke" in source
    assert "pull_request_target" not in source


def test_task_unpublish_dispatches_the_main_workflow_instead_of_applying_locally():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    source = "\n".join(taskfile["tasks"]["unpublish"]["cmds"])

    assert "gh workflow run unpublish.yml" in source
    assert "--ref main" in source
    assert "terraform apply" not in source


def test_mobile_preview_tasks_use_cloudflare_without_local_terraform_apply():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    source = "\n".join(taskfile["tasks"]["dev:mobile"]["cmds"])
    environment = taskfile["tasks"]["dev:mobile"]["env"]
    provision_source = "\n".join(taskfile["tasks"]["preview:provision"]["cmds"])

    assert "scripts/mobile_preview.py" in source
    assert environment["IKIMONO_SCAN_WEB_ROOT"] == "{{.WEB_ROOT}}"
    assert "gh workflow run preview.yml" in provision_source
    assert "--ref main" in provision_source
    assert "terraform apply" not in provision_source


def test_preview_workflow_is_manual_serialized_and_applies_a_saved_plan():
    workflow, source = _workflow("preview.yml")

    assert set(workflow[True]) == {"workflow_dispatch"}
    assert workflow["permissions"] == {"contents": "read"}
    assert workflow["concurrency"] == {
        "group": "preview-infrastructure",
        "cancel-in-progress": False,
    }
    assert "provision dev.ikimono-scan.app" in source
    assert "merge-base --is-ancestor" in source
    assert re.search(r"terraform .* plan .* -out=preview\.tfplan", source)
    assert re.search(r"terraform .* apply .* preview\.tfplan", source)
    assert "terraform_backend.py backup preview pre-apply" in source
    assert "terraform_backend.py backup preview post-apply" in source
    assert "pull_request_target" not in source
    assert "secrets.CLOUDFLARE_PREVIEW_API_TOKEN" in source
    assert "secrets.CLOUDFLARE_API_TOKEN" not in source


def test_preview_infrastructure_is_access_protected_for_cloudflare_account_members():
    source = (REPOSITORY_ROOT / "infra" / "preview" / "main.tf").read_text()

    assert 'hostname = "dev.ikimono-scan.app"' in source
    assert 'service  = "http://localhost:5175"' in source
    assert "cloudflare_zero_trust_access_application" in source
    assert "cloudflare_zero_trust_access_policy" in source
    assert "cloudflare_account_member" in source
    assert "email = {" not in source


def test_preview_routes_models_through_the_production_worker_and_r2():
    source = (REPOSITORY_ROOT / "infra" / "preview" / "main.tf").read_text()
    documentation = (REPOSITORY_ROOT / "infra" / "README.md").read_text()

    worker_block = source.split('resource "cloudflare_workers_script"', 1)[1].split(
        'resource "cloudflare_workers_route" "models"', 1
    )[0]
    assert 'content_file       = "${path.module}/../production/worker/index.js"' in worker_block
    assert "bucket_name = var.model_bucket_name" in worker_block
    assert 'name        = "MODELS"' in worker_block
    assert 'type        = "r2_bucket"' in worker_block
    assert 'pattern = "dev.ikimono-scan.app/models/*"' in source
    assert 'pattern = "dev.ikimono-scan.app/models/manifest.json*"' in source
    manifest_route = source.split('resource "cloudflare_workers_route" "model_manifest"', 1)[1]
    assert "script" not in manifest_route
    assert "Workers Scripts Edit" in documentation
    assert "Workers Routes Edit" in documentation


def test_gitleaks_rejects_personal_environment_identifiers():
    config = tomllib.loads(GITLEAKS_CONFIG.read_text())
    privacy_rule = next(
        rule for rule in config["rules"] if rule["id"] == "public-repository-personal-identifiers"
    )

    assert "@gmail" in privacy_rule["regex"]
    assert "/Users/" in privacy_rule["regex"]
    assert "[.]ts[.]net" in privacy_rule["regex"]
    assert "commits" not in privacy_rule["allowlist"]


def test_production_domain_can_be_removed_without_destroying_the_worker():
    source = (REPOSITORY_ROOT / "infra" / "production" / "main.tf").read_text()
    variables = (REPOSITORY_ROOT / "infra" / "production" / "variables.tf").read_text()

    assert 'variable "site_published"' in variables
    assert "count      = var.site_published ? 1 : 0" in source
    worker_block = source.split('resource "cloudflare_workers_script"', 1)[1].split(
        'resource "cloudflare_workers_custom_domain"', 1
    )[0]
    assert "site_published" not in worker_block


def test_secret_scan_runs_the_synced_pre_commit_environment():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    source = "\n".join(taskfile["tasks"]["secrets"]["cmds"])

    assert "uv run pre-commit run gitleaks --all-files" in source


def test_model_tasks_export_locally_and_upload_without_dispatching_actions():
    taskfile = yaml.safe_load(TASKFILE.read_text())
    export_source = "\n".join(taskfile["tasks"]["model:export"]["cmds"])
    upload_source = "\n".join(taskfile["tasks"]["model:upload"]["cmds"])
    smoke_source = "\n".join(taskfile["tasks"]["model:smoke"]["cmds"])

    assert "ikimono-scan-ml-export-web" in export_source
    assert "publish_model.py" in upload_source
    assert "gh workflow run" not in upload_source
    assert "verify_public_model.py" in smoke_source


def test_worker_serves_tracked_manifest_and_r2_model_objects():
    source = (REPOSITORY_ROOT / "infra/production/worker/index.js").read_text()

    manifest_branch = source.index("url.pathname === MODEL_MANIFEST")
    r2_lookup = source.index("env.MODELS.get(key)")
    assert "env.ASSETS.fetch(request)" in source[manifest_branch:r2_lookup]
