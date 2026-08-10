from pathlib import Path

import pytest
from ikimono_scan_ml.config import PredictionPolicy, load_yaml, project_path


def test_load_yaml_requires_mapping(tmp_path: Path) -> None:
    config = tmp_path / "config.yaml"
    config.write_text("- nope\n", encoding="utf-8")

    with pytest.raises(ValueError, match="Config must be a mapping"):
        load_yaml(config)


def test_prediction_policy_validates_threshold() -> None:
    with pytest.raises(ValueError, match="confidence_threshold"):
        PredictionPolicy.from_values(confidence_threshold=1.2)


def test_project_path_resolves_relative_to_root(tmp_path: Path) -> None:
    assert project_path("ml/data", root=tmp_path) == tmp_path / "ml/data"
