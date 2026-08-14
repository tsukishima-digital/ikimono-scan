import hashlib
import json
from pathlib import Path

import torch
from ikimono_scan_ml import web_export


def test_build_manifest_preserves_checkpoint_class_order() -> None:
    manifest = web_export.build_manifest(
        classes=["1008176_agelasta_yonaguni", "494519_aromia_bungii"],
        taxonomy_catalog={
            "1008176": {
                "scientificName": "Agelasta yonaguni",
                "commonName": "ヨナグニゴマフカミキリ",
            },
            "494519": {
                "scientificName": "Aromia bungii",
                "commonName": "クビアカツヤカミキリ",
            },
        },
        image_size=320,
        model_url="/models/beetles-v0.1.0.onnx",
        sha256="a" * 64,
        version="0.1.0",
        license_name="UNPUBLISHED",
        source="internal checkpoint",
    )

    assert manifest["classes"] == [
        {
            "id": "1008176",
            "scientificName": "Agelasta yonaguni",
            "commonName": "ヨナグニゴマフカミキリ",
        },
        {
            "id": "494519",
            "scientificName": "Aromia bungii",
            "commonName": "クビアカツヤカミキリ",
        },
    ]
    assert manifest["imageSize"] == 320
    assert manifest["inputName"] == "input"
    assert manifest["outputName"] == "logits"
    assert manifest["minimumConfidence"] == 0.6


def test_export_checkpoint_writes_model_and_manifest(tmp_path: Path, monkeypatch) -> None:
    checkpoint = {
        "architecture": "efficientnet_b0",
        "classes": ["494519_aromia_bungii"],
        "image_size": 320,
        "model_state": {"weight": torch.tensor([1.0])},
    }
    model = FakeModel()
    monkeypatch.setattr(web_export, "load_checkpoint", lambda *args, **kwargs: checkpoint)
    monkeypatch.setattr(web_export, "_build_model", lambda **kwargs: model)

    def fake_onnx_export(model_arg, example_input, output_path, **kwargs):
        assert model_arg is model
        assert tuple(example_input.shape) == (1, 3, 320, 320)
        assert kwargs["input_names"] == ["input"]
        assert kwargs["output_names"] == ["logits"]
        Path(output_path).write_bytes(b"onnx-model")

    monkeypatch.setattr(torch.onnx, "export", fake_onnx_export)

    artifacts = web_export.export_checkpoint(
        checkpoint_path=tmp_path / "best.pt",
        output_dir=tmp_path / "models",
        version="0.1.0",
        license_name="UNPUBLISHED",
        source="internal checkpoint",
        taxonomy_catalog_path=None,
    )

    model_bytes = artifacts.model_path.read_bytes()
    assert model.loaded_state == checkpoint["model_state"]
    assert model.evaluated
    assert artifacts.manifest_path == tmp_path / "models" / "manifest.json"
    manifest = json.loads(artifacts.manifest_path.read_text(encoding="utf-8"))
    assert manifest["modelUrl"] == "/models/beetles-v0.1.0.onnx"
    assert manifest["sha256"] == hashlib.sha256(model_bytes).hexdigest()


class FakeModel:
    def __init__(self) -> None:
        self.loaded_state = None
        self.evaluated = False

    def load_state_dict(self, state) -> None:
        self.loaded_state = state

    def eval(self):
        self.evaluated = True
        return self
