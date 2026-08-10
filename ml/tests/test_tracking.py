import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path

import pytest
import torch
from ikimono_scan_ml import tracking, training


class FakeRun:
    def __init__(self) -> None:
        self.info = type("Info", (), {"run_id": "run-123"})()


class FakeMlflow:
    def __init__(self) -> None:
        self.tracking_uri = None
        self.experiment_name = None
        self.run_name = None
        self.params = {}
        self.metrics = []
        self.artifacts = []
        self.artifact_texts = []
        self.inputs = []
        self.models = []
        self.ended = False
        self.data = type(
            "FakeData",
            (),
            {
                "from_pandas": lambda _, dataframe, source=None, name=None: {
                    "dataframe": dataframe,
                    "source": source,
                    "name": name,
                }
            },
        )()
        self.pytorch = type(
            "FakePyTorch",
            (),
            {
                "log_model": lambda _, model, name=None, metadata=None: self.models.append(
                    {"model": model, "name": name, "metadata": metadata}
                )
            },
        )()

    def set_tracking_uri(self, uri: str) -> None:
        self.tracking_uri = uri

    def set_experiment(self, name: str) -> None:
        self.experiment_name = name

    def start_run(self, *, run_name: str | None = None):
        self.run_name = run_name
        return FakeRun()

    def log_params(self, params: dict) -> None:
        self.params.update(params)

    def log_metrics(self, metrics: dict, step: int | None = None) -> None:
        self.metrics.append((metrics, step))

    def log_artifact(self, local_path: str, artifact_path: str | None = None) -> None:
        path = Path(local_path)
        self.artifacts.append((path, artifact_path))
        self.artifact_texts.append(path.read_text(encoding="utf-8"))

    def log_input(self, dataset, context: str | None = None) -> None:
        self.inputs.append((dataset, context))

    def end_run(self) -> None:
        self.ended = True


def test_flatten_params_keeps_mlflow_values_scalar() -> None:
    params = tracking.flatten_params(
        {
            "seed": 42,
            "data": {"image_size": 224},
            "training": {"lr_scheduler": {"type": "cosine", "min_learning_rate": 0.000001}},
            "tracking": {"backend": "mlflow"},
        }
    )

    assert params == {
        "seed": 42,
        "data.image_size": 224,
        "training.lr_scheduler.type": "cosine",
        "training.lr_scheduler.min_learning_rate": 0.000001,
    }


def test_mlflow_tracker_uses_local_file_store_and_logs_json_artifact(
    monkeypatch, tmp_path: Path
) -> None:
    fake_mlflow = FakeMlflow()
    monkeypatch.setitem(sys.modules, "mlflow", fake_mlflow)
    monkeypatch.delenv("MLFLOW_ALLOW_FILE_STORE", raising=False)

    config = {
        "seed": 42,
        "data": {"image_size": 224},
        "tracking": {
            "backend": "mlflow",
            "tracking_uri": str(tmp_path / "mlruns"),
            "experiment_name": "phase0",
            "run_name": "smoke",
        },
    }

    with tracking.create_experiment_tracker(config) as tracker:
        tracker.log_json({"ok": True}, "metadata/example.json")
        tracker.log_dataset(
            name="phase0",
            summary={
                "processed": {
                    "train": {"class_count": 2, "image_count": 8},
                    "val": {"class_count": 2, "image_count": 2},
                }
            },
            source="split_manifest.jsonl",
            context="training",
        )
        tracker.log_metrics({"accuracy": 0.5}, step=3)

    assert fake_mlflow.tracking_uri == (tmp_path / "mlruns").resolve().as_uri()
    assert os.environ["MLFLOW_ALLOW_FILE_STORE"] == "true"
    assert fake_mlflow.experiment_name == "phase0"
    assert fake_mlflow.run_name == "smoke"
    assert fake_mlflow.params == {"seed": 42, "data.image_size": 224}
    assert fake_mlflow.metrics == [({"accuracy": 0.5}, 3)]
    assert fake_mlflow.inputs[0][0]["name"] == "phase0"
    assert fake_mlflow.inputs[0][0]["source"] == "split_manifest.jsonl"
    assert fake_mlflow.inputs[0][1] == "training"
    assert fake_mlflow.ended is True
    artifact_path, artifact_group = fake_mlflow.artifacts[0]
    assert artifact_group == "metadata"
    assert artifact_path.name == "example.json"
    assert json.loads(fake_mlflow.artifact_texts[0]) == {"ok": True}


def test_auto_run_name_is_derived_from_training_config_without_negative_tokens() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 30,
                "optimizer": "sgd",
                "momentum": 0.9,
                "learning_rate": 0.03,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {
                "augmentation": {
                    "color_jitter": None,
                    "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
                }
            },
        }
    )

    assert name == "mobilenet_v3_small_sgd_m09_lr3e-2_cosine_e30_randaug_ops2_m7_color"
    assert "no_color" not in name


def test_auto_run_name_marks_explicit_color_jitter() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 30,
                "optimizer": "adamw",
                "learning_rate": 0.001,
                "lr_scheduler": {"type": "step"},
            },
            "data": {
                "augmentation": {
                    "color_jitter": {
                        "brightness": 0.2,
                        "contrast": 0.2,
                        "saturation": 0.2,
                    },
                    "rotation_degrees": 10,
                }
            },
        }
    )

    assert name == "mobilenet_v3_small_adamw_lr1e-3_step_e30_rot10_colorjitter"


def test_auto_run_name_marks_vertical_flip() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 30,
                "optimizer": "sgd",
                "momentum": 0.9,
                "learning_rate": 0.03,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {
                "augmentation": {
                    "vertical_flip": True,
                    "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
                    "color_jitter": None,
                }
            },
        }
    )

    assert name == "mobilenet_v3_small_sgd_m09_lr3e-2_cosine_e30_vflip_randaug_ops2_m7_color"


def test_auto_run_name_marks_non_default_image_size_and_label_smoothing() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "efficientnet_b0"},
            "training": {
                "epochs": 30,
                "optimizer": "sgd",
                "momentum": 0.9,
                "learning_rate": 0.03,
                "label_smoothing": 0.05,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {
                "image_size": 320,
                "augmentation": {
                    "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
                    "color_jitter": None,
                },
            },
        }
    )

    assert name == "efficientnet_b0_sgd_m09_lr3e-2_cosine_e30_img320_ls005_randaug_ops2_m7_color"


def test_auto_run_name_marks_aspect_preserving_padding_resize() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 30,
                "optimizer": "sgd",
                "momentum": 0.9,
                "learning_rate": 0.03,
                "label_smoothing": 0.05,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {
                "image_size": 320,
                "resize_mode": "pad",
                "augmentation": {
                    "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
                    "color_jitter": None,
                },
            },
        }
    )

    assert (
        name
        == "mobilenet_v3_small_sgd_m09_lr3e-2_cosine_e30_img320_pad_ls005_randaug_ops2_m7_color"
    )


def test_auto_run_name_marks_center_padding_position() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 30,
                "optimizer": "sgd",
                "momentum": 0.9,
                "learning_rate": 0.03,
                "label_smoothing": 0.05,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {
                "image_size": 320,
                "resize_mode": "pad",
                "pad_position": "center",
                "augmentation": {
                    "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
                    "color_jitter": None,
                },
            },
        }
    )

    assert name == (
        "mobilenet_v3_small_sgd_m09_lr3e-2_cosine_e30_img320_pad_center_ls005_randaug_ops2_m7_color"
    )


def test_auto_run_name_uses_default_augmentation_contract() -> None:
    name = tracking.build_auto_run_name(
        {
            "model": {"architecture": "mobilenet_v3_small"},
            "training": {
                "epochs": 10,
                "optimizer": "adamw",
                "learning_rate": 0.0003,
                "lr_scheduler": {"type": "cosine"},
            },
            "data": {},
        }
    )

    assert name == "mobilenet_v3_small_adamw_lr3e-4_cosine_e10_default_colorjitter"


def test_mlflow_tracker_uses_auto_run_name_when_requested(monkeypatch, tmp_path: Path) -> None:
    fake_mlflow = FakeMlflow()
    monkeypatch.setitem(sys.modules, "mlflow", fake_mlflow)

    config = {
        "model": {"architecture": "mobilenet_v3_small"},
        "training": {
            "epochs": 30,
            "optimizer": "sgd",
            "momentum": 0.9,
            "learning_rate": 0.03,
            "lr_scheduler": {"type": "cosine"},
        },
        "data": {
            "augmentation": {
                "color_jitter": None,
                "auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7},
            }
        },
        "tracking": {
            "backend": "mlflow",
            "tracking_uri": str(tmp_path / "mlruns"),
            "experiment_name": "phase0",
            "run_name": "auto",
        },
    }

    with tracking.create_experiment_tracker(config):
        pass

    assert (
        fake_mlflow.run_name == "mobilenet_v3_small_sgd_m09_lr3e-2_cosine_e30_randaug_ops2_m7_color"
    )


def test_dataset_summary_counts_raw_and_processed_images(tmp_path: Path) -> None:
    for relative in [
        "raw/Aromia_bungii/a.jpg",
        "raw/Aromia_bungii/b.jpg",
        "processed/train/Aromia_bungii/a.jpg",
        "processed/val/Aromia_bungii/b.jpg",
    ]:
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fake")

    summary = tracking.build_dataset_summary(
        raw_dir=tmp_path / "raw",
        processed_dir=tmp_path / "processed",
    )

    assert summary["raw"]["image_count"] == 2
    assert summary["raw"]["class_count"] == 1
    assert summary["processed"]["train"]["image_count"] == 1
    assert summary["processed"]["val"]["image_count"] == 1


def test_git_metadata_uses_environment_fallback_when_git_is_unavailable(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("HUNTLOG_GIT_COMMIT", "abc123")
    monkeypatch.setenv("HUNTLOG_GIT_BRANCH", "codex/mlflow-tracking")
    monkeypatch.setenv("HUNTLOG_GIT_STATUS", "")
    monkeypatch.setenv("HUNTLOG_GIT_DIRTY", "false")

    metadata = tracking.collect_git_metadata(tmp_path)

    assert metadata == {
        "commit": "abc123",
        "branch": "codex/mlflow-tracking",
        "status": "",
        "dirty": False,
    }


def test_train_from_config_logs_reproducibility_artifacts(monkeypatch, tmp_path: Path) -> None:
    config_path = tmp_path / "train.yaml"
    raw_dir = tmp_path / "raw"
    processed_dir = tmp_path / "processed"
    model_dir = tmp_path / "models"
    report_dir = tmp_path / "reports"
    config_path.write_text(
        f"""
seed: 42
data:
  raw_dir: {raw_dir}
  processed_dir: {processed_dir}
  train_split: 0.8
  min_images_per_class: 1
  image_size: 32
  num_workers: 0
model:
  architecture: mobilenet_v3_small
  pretrained: false
training:
  epochs: 1
  batch_size: 2
  learning_rate: 0.001
  weight_decay: 0.0
  mixed_precision: false
  mixed_precision_dtype: fp16
output:
  model_dir: {model_dir}
  report_dir: {report_dir}
tracking:
  backend: mlflow
  tracking_uri: {tmp_path / "mlruns"}
  experiment_name: phase0
  dataset_name: test_dataset
  model_name: test_model
""",
        encoding="utf-8",
    )

    class FakeDataset:
        classes = ["Aromia_bungii"]
        class_to_idx = {"Aromia_bungii": 0}

    class FakeModel:
        def to(self, device):
            return self

        def parameters(self):
            return [torch.nn.Parameter(torch.tensor(1.0))]

        def state_dict(self):
            return {"weight": torch.tensor(1.0)}

        def load_state_dict(self, state):
            return None

    class FakeTracker:
        def __init__(self) -> None:
            self.json_files = []
            self.artifacts = []
            self.metrics = []

        def log_json(self, payload, artifact_file):
            self.json_files.append(artifact_file)

        def log_artifact(self, path, *, artifact_path=None):
            self.artifacts.append((Path(path).name, artifact_path))

        def log_metrics(self, metrics, *, step=None):
            self.metrics.append((metrics, step))

        def log_dataset(self, *, name, summary, source, context):
            self.json_files.append(f"dataset:{name}:{context}:{source}")

        def log_model(self, model, *, name, metadata):
            self.json_files.append(f"model:{name}:{metadata['class_count']}")

    fake_tracker = FakeTracker()

    @contextmanager
    def fake_create_tracker(config):
        yield fake_tracker

    monkeypatch.setattr(training, "create_experiment_tracker", fake_create_tracker)
    monkeypatch.setattr(
        training,
        "collect_git_metadata",
        lambda: {"commit": "abc", "branch": "main", "dirty": False},
    )
    monkeypatch.setattr(training, "collect_git_diff", lambda: "")
    monkeypatch.setattr(training, "collect_environment_metadata", lambda: {"torch": "test"})
    monkeypatch.setattr(
        training,
        "build_dataset_summary",
        lambda **kwargs: {"raw": {}, "processed": {}},
    )
    monkeypatch.setattr(
        training,
        "write_split_manifest",
        lambda **kwargs: kwargs["output_path"].write_text(""),
    )
    monkeypatch.setattr(training, "_prepare_split", lambda **kwargs: None)
    monkeypatch.setattr(training.datasets, "ImageFolder", lambda *args, **kwargs: FakeDataset())
    monkeypatch.setattr(training, "DataLoader", lambda *args, **kwargs: object())
    monkeypatch.setattr(training, "_build_model", lambda **kwargs: FakeModel())
    monkeypatch.setattr(training, "_build_lr_scheduler", lambda *args, **kwargs: None)
    monkeypatch.setattr(training, "_create_grad_scaler", lambda *args, **kwargs: object())
    monkeypatch.setattr(training, "_train_epoch", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        training,
        "evaluate_model",
        lambda *args, **kwargs: {
            "accuracy": 0.7,
            "classification_report": {},
            "confusion_matrix": [[1]],
            "classes": ["Aromia_bungii"],
        },
    )
    monkeypatch.setattr(
        training.torch,
        "save",
        lambda checkpoint, path: Path(path).write_text(json.dumps({"accuracy": 0.7})),
    )
    monkeypatch.setattr(
        training.torch,
        "load",
        lambda *args, **kwargs: {
            "model_state": {},
            "architecture": "mobilenet_v3_small",
            "classes": ["Aromia_bungii"],
            "image_size": 32,
        },
    )

    artifacts = training.train_from_config(config_path)

    assert artifacts.checkpoint_path == model_dir / "best.pt"
    assert "metadata/git.json" in fake_tracker.json_files
    assert "metadata/environment.json" in fake_tracker.json_files
    assert "metadata/dataset_summary.json" in fake_tracker.json_files
    assert any(
        item.startswith("dataset:test_dataset:training:") for item in fake_tracker.json_files
    )
    assert "model:test_model:1" in fake_tracker.json_files
    assert ("class_index.json", "outputs") in fake_tracker.artifacts
    assert ("metrics.json", "outputs") in fake_tracker.artifacts
    assert ("best.pt", "outputs") in fake_tracker.artifacts
    assert "outputs/final_metrics.json" in fake_tracker.json_files
    assert fake_tracker.metrics == [
        ({"accuracy": 0.7}, 1),
    ]


def test_mlflow_training_rejects_non_main_branch() -> None:
    with pytest.raises(RuntimeError, match="main"):
        training._ensure_training_branch_allowed(
            {"tracking": {"backend": "mlflow"}},
            {"branch": "codex/experiment"},
        )


def test_training_branch_guard_allows_noop_tracking() -> None:
    training._ensure_training_branch_allowed(
        {"tracking": {"backend": "none"}},
        {"branch": "codex/experiment"},
    )
