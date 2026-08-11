import pytest

from scripts.mobile_preview import tailnet_hostname


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
