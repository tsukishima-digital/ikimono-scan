import hashlib
import json

import pytest

from scripts.verify_model_release import verify


def _bundle(tmp_path, *, license_name="CC-BY-NC-4.0"):
    model = tmp_path / "beetles-v1.onnx"
    model.write_bytes(b"model")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "modelUrl": f"/models/{model.name}",
                "sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
                "license": license_name,
                "source": "release test",
                "classes": [{"taxonId": 1, "scientificName": "Aromia bungii"}],
            }
        )
    )
    return manifest, model


def test_accepts_a_licensed_bundle_with_matching_hash(tmp_path):
    manifest, model = _bundle(tmp_path)

    verify(manifest, model)


def test_rejects_an_unpublished_license(tmp_path):
    manifest, model = _bundle(tmp_path, license_name="UNPUBLISHED")

    with pytest.raises(ValueError, match="license"):
        verify(manifest, model)


def test_rejects_a_model_that_does_not_match_the_manifest(tmp_path):
    manifest, model = _bundle(tmp_path)
    model.write_bytes(b"different")

    with pytest.raises(ValueError, match="SHA-256"):
        verify(manifest, model)
