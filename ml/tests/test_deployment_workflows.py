import re
from pathlib import Path

import yaml

REPOSITORY_ROOT = Path(__file__).parents[2]
WORKFLOWS = REPOSITORY_ROOT / ".github" / "workflows"
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
    for workflow_name in ("ci.yml", "terraform-plan.yml", "deploy.yml"):
        workflow, _ = _workflow(workflow_name)
        for action in _uses_values(workflow):
            assert PINNED_ACTION.fullmatch(action), f"{workflow_name}: {action}"


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
    assert re.search(r"terraform .* apply .* \S+\.tfplan", source)
    assert "merge-base --is-ancestor" in source
    assert "terraform_backend.py backup production pre-apply" in source
    assert "terraform_backend.py backup production post-apply" in source
    assert source.index("Download and verify model release") < source.index(
        "Bootstrap remote state"
    )
    assert "pull_request_target" not in source
