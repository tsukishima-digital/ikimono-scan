import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.publish_model import ModelPublisher

REPOSITORY_ROOT = Path(__file__).parents[2]


def _bundle(tmp_path: Path) -> tuple[Path, Path]:
    model = tmp_path / "beetles-v1.0.0.onnx"
    model.write_bytes(b"licensed model")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "modelUrl": f"/models/{model.name}",
                "sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
                "license": "CC-BY-NC-4.0",
                "source": "audited training set",
                "classes": [{"id": "494519", "scientificName": "Aromia bungii"}],
            }
        )
    )
    return manifest, model


class FakeRemote:
    def __init__(self, *, exists: bool = False, downloaded: bytes = b"licensed model"):
        self.exists = exists
        self.downloaded = downloaded
        self.checked_urls: list[str] = []
        self.uploads: list[tuple[Path, str]] = []

    def object_exists(self, url: str) -> bool:
        self.checked_urls.append(url)
        return self.exists

    def upload(self, model: Path, key: str) -> None:
        self.uploads.append((model, key))

    def download_sha256(self, _url: str) -> str:
        return hashlib.sha256(self.downloaded).hexdigest()


def test_uploads_verified_model_then_promotes_manifest(tmp_path: Path):
    manifest, model = _bundle(tmp_path)
    tracked_manifest = tmp_path / "tracked" / "manifest.json"
    remote = FakeRemote()

    ModelPublisher(remote=remote, public_base_url="https://example.test/models/").publish(
        manifest_path=manifest,
        model_path=model,
        tracked_manifest_path=tracked_manifest,
    )

    assert remote.uploads == [(model, model.name)]
    assert remote.checked_urls == ["https://example.test/models/beetles-v1.0.0.onnx"]
    assert json.loads(tracked_manifest.read_text()) == json.loads(manifest.read_text())


def test_refuses_to_overwrite_a_published_model(tmp_path: Path):
    manifest, model = _bundle(tmp_path)

    with pytest.raises(ValueError, match="already exists"):
        ModelPublisher(remote=FakeRemote(exists=True)).publish(
            manifest_path=manifest,
            model_path=model,
            tracked_manifest_path=tmp_path / "tracked.json",
        )


def test_does_not_promote_manifest_when_remote_hash_differs(tmp_path: Path):
    manifest, model = _bundle(tmp_path)
    tracked_manifest = tmp_path / "tracked.json"

    with pytest.raises(ValueError, match="remote model SHA-256"):
        ModelPublisher(remote=FakeRemote(downloaded=b"wrong")).publish(
            manifest_path=manifest,
            model_path=model,
            tracked_manifest_path=tracked_manifest,
        )

    assert not tracked_manifest.exists()


def test_publish_script_can_be_invoked_directly():
    result = subprocess.run(
        [sys.executable, "scripts/publish_model.py", "--help"],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
