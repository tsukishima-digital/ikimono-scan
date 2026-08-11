from scripts.mobile_preview import PREVIEW_HOSTNAME, tunnel_command, vite_command


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
