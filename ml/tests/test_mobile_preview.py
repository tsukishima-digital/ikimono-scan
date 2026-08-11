import pytest

from scripts.mobile_preview import preview_url, serve_command, tailnet_hostname


def test_tailnet_hostname_requires_an_online_running_tailscale_node():
    status = {
        "BackendState": "Running",
        "Self": {"DNSName": "itto.tailfa1ce7.ts.net.", "Online": True},
    }

    assert tailnet_hostname(status) == "itto.tailfa1ce7.ts.net"


@pytest.mark.parametrize(
    "status",
    [
        {"BackendState": "Stopped", "Self": {}},
        {"BackendState": "Running", "Self": {"Online": False}},
        {"BackendState": "Running", "Self": {"Online": True, "DNSName": ""}},
    ],
)
def test_tailnet_hostname_rejects_unreachable_nodes(status):
    with pytest.raises(RuntimeError, match="Tailscale"):
        tailnet_hostname(status)


def test_https_preview_is_the_default():
    assert preview_url("device.example.ts.net", insecure_http=False) == (
        "https://device.example.ts.net"
    )
    assert serve_command("tailscale", 5175, insecure_http=False) == [
        "tailscale",
        "serve",
        "--yes",
        "5175",
    ]


def test_http_preview_requires_an_explicit_fallback():
    assert preview_url("device.example.ts.net", insecure_http=True) == (
        "http://device.example.ts.net"
    )
    assert serve_command("tailscale", 5175, insecure_http=True) == [
        "tailscale",
        "serve",
        "--yes",
        "--http=80",
        "5175",
    ]
