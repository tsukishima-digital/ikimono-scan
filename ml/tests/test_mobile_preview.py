from pathlib import Path

from scripts.mobile_preview import (
    PREVIEW_HOSTNAME,
    preview_environment,
    resolve_web_root,
    tunnel_command,
    vite_command,
)


def test_mobile_preview_uses_the_access_protected_https_hostname():
    assert PREVIEW_HOSTNAME == "dev.ikimono-scan.app"


def test_mobile_preview_runs_the_tracked_vite_and_named_tunnel_commands():
    assert vite_command() == [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "5175",
        "--strictPort",
    ]
    assert tunnel_command() == [
        "npm",
        "exec",
        "--",
        "wrangler",
        "tunnel",
        "run",
        "ikimono-scan-preview",
    ]


def test_mobile_preview_can_serve_a_ui_worktree(tmp_path: Path):
    web_package = tmp_path / "web"
    web_package.mkdir()
    (web_package / "package.json").write_text("{}")

    web_root = resolve_web_root(str(web_package))
    environment = preview_environment({})

    assert web_root == web_package
    assert environment["__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS"] == PREVIEW_HOSTNAME


def test_mobile_preview_rejects_a_directory_without_the_web_package(tmp_path: Path):
    try:
        resolve_web_root(str(tmp_path))
    except ValueError as error:
        assert "package.json" in str(error)
    else:
        raise AssertionError("A non-web directory must not be accepted")
