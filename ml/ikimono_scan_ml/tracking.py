from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import torch
import torchvision

from ikimono_scan_ml.config import project_path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class NoopExperimentTracker:
    run_id: str | None = None

    def log_params(self, params: dict[str, Any]) -> None:
        pass

    def log_metrics(self, metrics: dict[str, float], *, step: int | None = None) -> None:
        pass

    def log_artifact(self, path: str | Path, *, artifact_path: str | None = None) -> None:
        pass

    def log_json(self, payload: dict[str, Any], artifact_file: str) -> None:
        pass

    def log_dataset(
        self,
        *,
        name: str,
        summary: dict[str, Any],
        source: str,
        context: str,
    ) -> None:
        pass

    def log_model(
        self,
        model: torch.nn.Module,
        *,
        name: str,
        metadata: dict[str, Any],
    ) -> None:
        pass


class MLflowExperimentTracker:
    def __init__(self, mlflow_module, *, temp_dir: Path) -> None:
        self._mlflow = mlflow_module
        self._temp_dir = temp_dir
        active_run = mlflow_module.start_run()
        self.run_id = active_run.info.run_id

    def log_params(self, params: dict[str, Any]) -> None:
        if params:
            self._mlflow.log_params(params)

    def log_metrics(self, metrics: dict[str, float], *, step: int | None = None) -> None:
        if metrics:
            self._mlflow.log_metrics(metrics, step=step)

    def log_artifact(self, path: str | Path, *, artifact_path: str | None = None) -> None:
        self._mlflow.log_artifact(str(path), artifact_path=artifact_path)

    def log_json(self, payload: dict[str, Any], artifact_file: str) -> None:
        target = self._temp_dir / artifact_file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.log_artifact(target, artifact_path=str(target.parent.relative_to(self._temp_dir)))

    def log_dataset(
        self,
        *,
        name: str,
        summary: dict[str, Any],
        source: str,
        context: str,
    ) -> None:
        import pandas as pd

        rows = []
        processed = summary.get("processed", {})
        for split_name in ("train", "val"):
            split_summary = processed.get(split_name, {})
            rows.append(
                {
                    "split": split_name,
                    "class_count": int(split_summary.get("class_count", 0)),
                    "image_count": int(split_summary.get("image_count", 0)),
                }
            )
        dataframe = pd.DataFrame(rows)
        dataset = self._mlflow.data.from_pandas(dataframe, source=source, name=name)
        self._mlflow.log_input(dataset, context=context)

    def log_model(
        self,
        model: torch.nn.Module,
        *,
        name: str,
        metadata: dict[str, Any],
    ) -> None:
        self._mlflow.pytorch.log_model(
            model,
            name=name,
            metadata=metadata,
            serialization_format="pickle",
        )

    def end(self) -> None:
        self._mlflow.end_run()


@contextmanager
def create_experiment_tracker(config: dict[str, Any]) -> Iterator[NoopExperimentTracker]:
    tracking_config = config.get("tracking", {})
    if str(tracking_config.get("backend", "none")) == "none":
        yield NoopExperimentTracker()
        return

    if str(tracking_config["backend"]) != "mlflow":
        raise ValueError("tracking.backend must be none or mlflow")

    os.environ.setdefault("GIT_PYTHON_REFRESH", "quiet")
    import mlflow

    tracking_uri = _resolve_tracking_uri(str(tracking_config["tracking_uri"]))
    if tracking_uri.startswith("file:"):
        # Implementation: Phase 0 uses a local free MLflow store; MLflow 3 requires this opt-out.
        os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(str(tracking_config["experiment_name"]))
    run_name = resolve_tracking_name(tracking_config.get("run_name"), config)
    with tempfile.TemporaryDirectory() as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        active_run = mlflow.start_run(run_name=str(run_name) if run_name else None)
        tracker = MLflowExperimentTracker.__new__(MLflowExperimentTracker)
        tracker._mlflow = mlflow
        tracker._temp_dir = temp_dir
        tracker.run_id = active_run.info.run_id
        try:
            tracker.log_params(flatten_params(config))
            yield tracker
        finally:
            tracker.end()


def flatten_params(config: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}

    def visit(prefix: str, value: Any) -> None:
        if isinstance(value, dict):
            for child_key, child_value in value.items():
                visit(f"{prefix}.{child_key}" if prefix else str(child_key), child_value)
            return
        if isinstance(value, list):
            params[prefix] = json.dumps(value, ensure_ascii=False, sort_keys=True)
            return
        if value is None or isinstance(value, str | int | float | bool):
            params[prefix] = value
            return
        params[prefix] = str(value)

    for key, value in config.items():
        if key == "tracking":
            continue
        visit(str(key), value)
    return params


def resolve_tracking_name(value: Any, config: dict[str, Any]) -> str | None:
    if value is None or str(value) == "auto":
        return build_auto_run_name(config)
    return str(value)


def build_auto_run_name(config: dict[str, Any]) -> str:
    model_config = config.get("model", {})
    training_config = config.get("training", {})
    data_config = config.get("data", {})

    parts = [
        _slug(str(model_config.get("architecture", "model"))),
        _optimizer_token(training_config),
        f"lr{_format_learning_rate(float(training_config.get('learning_rate', 0.0)))}",
        _scheduler_token(training_config.get("lr_scheduler")),
        f"e{int(training_config.get('epochs', 0))}",
    ]
    if int(data_config.get("image_size", 224)) != 224:
        parts.append(f"img{int(data_config['image_size'])}")
    if str(data_config.get("resize_mode", "crop")) != "crop":
        parts.append(_slug(str(data_config["resize_mode"])))
        if str(data_config.get("pad_position", "random")) != "random":
            parts.append(_slug(str(data_config["pad_position"])))
    if float(training_config.get("label_smoothing", 0.0)) > 0:
        parts.append(f"ls{_format_decimal_token(float(training_config['label_smoothing']))}")
    parts.extend(_augmentation_tokens(data_config.get("augmentation")))
    return "_".join(part for part in parts if part)


def _optimizer_token(training_config: dict[str, Any]) -> str:
    optimizer = _slug(str(training_config.get("optimizer", "optimizer")))
    if optimizer == "sgd" and "momentum" in training_config:
        momentum = float(training_config["momentum"])
        return f"sgd_m{int(round(momentum * 10)):02d}"
    return optimizer


def _scheduler_token(scheduler_config: Any) -> str:
    if not scheduler_config:
        return "none"
    if isinstance(scheduler_config, dict):
        return _slug(str(scheduler_config.get("type", "scheduler")))
    return _slug(str(scheduler_config))


def _augmentation_tokens(augmentation_config: Any) -> list[str]:
    if augmentation_config is None:
        return ["default", "colorjitter"]
    if not isinstance(augmentation_config, dict):
        return [_slug(str(augmentation_config))]

    tokens: list[str] = []
    if augmentation_config.get("vertical_flip"):
        tokens.append("vflip")

    if rotation_degrees := augmentation_config.get("rotation_degrees"):
        tokens.append(f"rot{_format_number(float(rotation_degrees))}")

    auto_augment_config = augmentation_config.get("auto_augment")
    if isinstance(auto_augment_config, dict):
        auto_augment_type = str(auto_augment_config.get("type", "none"))
        if auto_augment_type == "randaugment":
            tokens.append(
                "randaug"
                f"_ops{int(auto_augment_config.get('num_ops', 2))}"
                f"_m{int(auto_augment_config.get('magnitude', 9))}"
            )
            tokens.append("color")
        elif auto_augment_type == "trivial":
            tokens.extend(["trivial", "color"])
    elif auto_augment_config:
        tokens.append(_slug(str(auto_augment_config)))

    color_jitter_config = augmentation_config.get(
        "color_jitter",
        {"brightness": 0.2, "contrast": 0.2, "saturation": 0.2},
    )
    if color_jitter_config:
        tokens.append("colorjitter")

    random_erasing_config = augmentation_config.get("random_erasing")
    if random_erasing_config:
        if isinstance(random_erasing_config, dict):
            p = float(random_erasing_config.get("p", 0.5))
            tokens.append(f"erasep{int(round(p * 100)):02d}")
        else:
            tokens.append("erase")

    return tokens or ["aug"]


def _format_learning_rate(value: float) -> str:
    if value == 0:
        return "0"
    formatted = f"{value:.0e}".replace("e-0", "e-").replace("e+0", "e")
    return formatted.replace("e+", "e")


def _format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value).replace(".", "p")


def _format_decimal_token(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".").replace(".", "")


def _slug(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else "_" for char in value).strip("_")


def collect_git_metadata(root: Path | None = None) -> dict[str, Any]:
    root = root or Path.cwd()
    env_commit = os.getenv("IKIMONO_SCAN_GIT_COMMIT")
    if env_commit:
        env_status = os.getenv("IKIMONO_SCAN_GIT_STATUS", "")
        return {
            "commit": env_commit,
            "branch": os.getenv("IKIMONO_SCAN_GIT_BRANCH", ""),
            "status": env_status,
            "dirty": os.getenv("IKIMONO_SCAN_GIT_DIRTY", str(bool(env_status))).lower()
            in {"1", "true", "yes"},
        }
    return {
        "commit": _git(["rev-parse", "HEAD"], root),
        "branch": _git(["branch", "--show-current"], root),
        "status": _git(["status", "--short"], root),
        "dirty": bool(_git(["status", "--porcelain"], root)),
    }


def collect_git_diff(root: Path | None = None) -> str:
    return _git(["diff", "--binary"], root or Path.cwd())


def collect_environment_metadata() -> dict[str, Any]:
    cuda_available = torch.cuda.is_available()
    return {
        "python": sys.version,
        "platform": platform.platform(),
        "torch": torch.__version__,
        "torchvision": torchvision.__version__,
        "cuda_available": cuda_available,
        "cuda_version": torch.version.cuda,
        "cudnn_version": torch.backends.cudnn.version(),
        "gpu_names": [
            torch.cuda.get_device_name(index) for index in range(torch.cuda.device_count())
        ]
        if cuda_available
        else [],
    }


def build_dataset_summary(*, raw_dir: Path, processed_dir: Path) -> dict[str, Any]:
    return {
        "raw": _summarize_class_dir(raw_dir),
        "processed": {
            "train": _summarize_class_dir(processed_dir / "train"),
            "val": _summarize_class_dir(processed_dir / "val"),
        },
    }


def write_split_manifest(*, processed_dir: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output_file:
        for split_name in ("train", "val"):
            split_dir = processed_dir / split_name
            if not split_dir.exists():
                continue
            for image_path in sorted(path for path in split_dir.rglob("*") if _is_image(path)):
                output_file.write(
                    json.dumps(
                        {
                            "split": split_name,
                            "class_name": image_path.parent.name,
                            "path": image_path.as_posix(),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )


def scalar_metrics(metrics: dict[str, Any]) -> dict[str, float]:
    report = metrics.get("classification_report", {})
    scalars = {"accuracy": float(metrics.get("accuracy", 0.0))}
    for label in ("macro avg", "weighted avg"):
        if label in report and isinstance(report[label], dict):
            key_prefix = label.replace(" ", "_")
            for metric_name in ("precision", "recall", "f1-score"):
                if metric_name in report[label]:
                    scalars[f"{key_prefix}.{metric_name}"] = float(report[label][metric_name])
    return scalars


def prefixed_metrics(metrics: dict[str, float], *, prefix: str) -> dict[str, float]:
    return {f"{prefix}.{key}": value for key, value in metrics.items()}


def _resolve_tracking_uri(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme:
        return value
    return project_path(value).resolve().as_uri()


def _summarize_class_dir(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"class_count": 0, "image_count": 0, "classes": {}}
    classes: dict[str, int] = {}
    for class_dir in sorted(child for child in path.iterdir() if child.is_dir()):
        count = sum(1 for image_path in class_dir.iterdir() if _is_image(image_path))
        if count > 0:
            classes[class_dir.name] = count
    return {
        "class_count": len(classes),
        "image_count": sum(classes.values()),
        "classes": classes,
    }


def _is_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES


def _git(args: list[str], root: Path) -> str:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return ""
    return completed.stdout.strip()
