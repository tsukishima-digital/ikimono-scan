import json
from pathlib import Path

from ikimono_scan_ml import training
from ikimono_scan_ml.config import load_yaml
from PIL import Image


def _write_images(class_dir: Path, count: int) -> None:
    class_dir.mkdir(parents=True)
    for index in range(count):
        Image.new("RGB", (8, 8)).save(class_dir / f"{index}.jpg")


def test_prepare_split_includes_only_classes_named_by_the_cohort_manifest(tmp_path: Path) -> None:
    raw_dir = tmp_path / "raw"
    _write_images(raw_dir / "10_included_species", 4)
    _write_images(raw_dir / "20_other_species", 4)
    manifest_path = tmp_path / "taxa.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "taxa": [{"classDirName": "10_included_species"}],
            }
        ),
        encoding="utf-8",
    )

    training._prepare_split(
        raw_dir=raw_dir,
        processed_dir=tmp_path / "processed",
        train_split=0.75,
        min_images_per_class=2,
        seed=42,
        included_class_dirs=training._load_class_dirs(manifest_path),
    )

    assert sorted(path.name for path in (tmp_path / "processed/train").iterdir()) == [
        "10_included_species"
    ]
    assert sorted(path.name for path in (tmp_path / "processed/val").iterdir()) == [
        "10_included_species"
    ]


def test_arthropoda_training_configs_share_the_cohort_but_not_the_split() -> None:
    full = load_yaml("ml/experiments/japan_species_classifier/configs/arthropoda_train.yaml")
    baseline = load_yaml(
        "ml/experiments/japan_species_classifier/configs/arthropoda_baseline_train.yaml"
    )

    assert full["model"]["architecture"] == "efficientnet_b0"
    assert baseline["model"]["architecture"] == "efficientnet_b0"
    assert full["data"]["image_size"] == baseline["data"]["image_size"] == 320
    assert full["data"]["class_manifest"] == baseline["data"]["class_manifest"]
    assert full["data"]["processed_dir"] != baseline["data"]["processed_dir"]
    assert full["training"]["epochs"] == 30
    assert baseline["training"]["epochs"] == 10
