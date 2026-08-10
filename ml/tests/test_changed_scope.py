from scripts.changed_scope import scopes_for_paths


def test_web_changes_only_select_web_checks():
    assert scopes_for_paths(["web/src/App.tsx"]) == {"web"}


def test_python_changes_only_select_python_checks():
    assert scopes_for_paths(["ml/src/ikimono_scan/train.py"]) == {"python"}


def test_shared_ci_changes_select_both_checks():
    assert scopes_for_paths([".github/workflows/ci.yml"]) == {"python", "web"}


def test_non_executable_docs_do_not_select_code_checks():
    assert scopes_for_paths(["README.md", "docs/architecture.md"]) == set()


def test_python_tooling_and_scripts_select_python_checks():
    assert scopes_for_paths(["pyproject.toml", "scripts/changed_scope.py"]) == {"python"}
