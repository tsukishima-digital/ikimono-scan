from scripts.changed_scope import scopes_for_paths


def test_web_changes_only_select_web_checks():
    assert scopes_for_paths(["web/src/App.tsx"]) == {"web"}


def test_python_changes_only_select_python_checks():
    assert scopes_for_paths(["ml/src/ikimono_scan/train.py"]) == {"python"}


def test_shared_ci_changes_select_both_checks():
    assert scopes_for_paths([".github/workflows/ci.yml"]) == {"infra", "python", "web"}


def test_terraform_changes_select_infra_checks():
    assert scopes_for_paths(["infra/production/main.tf"]) == {"infra"}


def test_deployment_workflow_selects_infra_and_web_checks():
    assert scopes_for_paths([".github/workflows/deploy.yml"]) == {"infra", "web"}


def test_non_executable_docs_do_not_select_code_checks():
    assert scopes_for_paths(["README.md", "docs/architecture.md"]) == set()


def test_python_tooling_and_scripts_select_python_checks():
    assert scopes_for_paths(["pyproject.toml", "scripts/changed_scope.py"]) == {"python"}
