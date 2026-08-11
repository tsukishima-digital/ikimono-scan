import hashlib
import io
import json
import urllib.request

import pytest

from scripts.verify_public_model import verify_public_model


def _manifest(tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "modelUrl": "/models/beetles-v0.1.0.onnx",
                "sha256": hashlib.sha256(b"model").hexdigest(),
            }
        )
    )
    return manifest


def test_public_model_must_match_the_tracked_manifest(tmp_path):
    url = verify_public_model(
        _manifest(tmp_path),
        public_base_url="https://example.test/",
        download=lambda requested_url: b"model",
    )

    assert url == "https://example.test/models/beetles-v0.1.0.onnx"


def test_public_model_rejects_a_different_sha256(tmp_path):
    with pytest.raises(ValueError, match="public model SHA-256"):
        verify_public_model(
            _manifest(tmp_path),
            public_base_url="https://example.test/",
            download=lambda requested_url: b"different",
        )


def test_public_model_download_uses_a_browser_compatible_user_agent(tmp_path, monkeypatch):
    requests = []

    class Response(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

    def urlopen(request, timeout):
        requests.append(request)
        return Response(b"model")

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)

    verify_public_model(
        _manifest(tmp_path),
        public_base_url="https://example.test/",
    )

    assert len(requests) == 1
    assert requests[0].full_url == "https://example.test/models/beetles-v0.1.0.onnx"
    assert requests[0].get_header("User-agent").startswith("Mozilla/5.0")
