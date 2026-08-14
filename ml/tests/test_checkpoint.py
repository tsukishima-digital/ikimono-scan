import pickle
from pathlib import Path

import pytest
import torch
from ikimono_scan_ml.checkpoint import load_checkpoint


def test_load_checkpoint_accepts_tensor_only_training_state(tmp_path: Path) -> None:
    path = tmp_path / "checkpoint.pt"
    torch.save(
        {
            "architecture": "efficientnet_b0",
            "classes": ["494519_aromia_bungii"],
            "model_state": {"weight": torch.tensor([1.0])},
        },
        path,
    )

    checkpoint = load_checkpoint(path, map_location="cpu")

    assert checkpoint["architecture"] == "efficientnet_b0"
    assert torch.equal(checkpoint["model_state"]["weight"], torch.tensor([1.0]))


def test_load_checkpoint_rejects_objects_outside_the_weights_allowlist(tmp_path: Path) -> None:
    path = tmp_path / "checkpoint.pt"
    torch.save({"payload": _UnsupportedCheckpointValue()}, path)

    with pytest.raises(pickle.UnpicklingError, match="Weights only load failed"):
        load_checkpoint(path, map_location="cpu")


class _UnsupportedCheckpointValue:
    pass
