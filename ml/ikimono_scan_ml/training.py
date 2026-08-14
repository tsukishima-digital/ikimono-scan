from __future__ import annotations

import argparse
import json
import random
import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from tqdm import tqdm

from ikimono_scan_ml.checkpoint import load_checkpoint
from ikimono_scan_ml.config import load_yaml, project_path
from ikimono_scan_ml.tracking import (
    build_dataset_summary,
    collect_environment_metadata,
    collect_git_diff,
    collect_git_metadata,
    create_experiment_tracker,
    resolve_tracking_name,
    scalar_metrics,
    write_split_manifest,
)

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


@dataclass(frozen=True)
class TrainArtifacts:
    checkpoint_path: Path
    class_index_path: Path
    report_path: Path


def train_from_config(config_path: str | Path) -> TrainArtifacts:
    config_path = Path(config_path)
    config = load_yaml(config_path)
    git_metadata = collect_git_metadata()
    _ensure_training_branch_allowed(config, git_metadata)
    seed = int(config["seed"])
    _seed_everything(seed)

    data_config = config["data"]
    model_config = config["model"]
    training_config = config["training"]
    output_config = config["output"]

    raw_dir = project_path(data_config["raw_dir"])
    processed_dir = project_path(data_config["processed_dir"])
    model_dir = project_path(output_config["model_dir"])
    report_dir = project_path(output_config["report_dir"])
    model_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    _prepare_split(
        raw_dir=raw_dir,
        processed_dir=processed_dir,
        train_split=float(data_config["train_split"]),
        min_images_per_class=int(data_config["min_images_per_class"]),
        seed=seed,
        included_class_dirs=(
            _load_class_dirs(project_path(data_config["class_manifest"]))
            if data_config.get("class_manifest")
            else None
        ),
    )

    image_size = int(data_config["image_size"])
    resize_mode = str(data_config.get("resize_mode", "crop"))
    pad_position = str(data_config.get("pad_position", "random"))
    train_dataset = datasets.ImageFolder(
        processed_dir / "train",
        transform=_train_transforms(
            image_size,
            data_config.get("augmentation"),
            resize_mode=resize_mode,
            pad_position=pad_position,
        ),
    )
    val_dataset = datasets.ImageFolder(
        processed_dir / "val",
        transform=_eval_transforms(image_size, resize_mode=resize_mode),
    )
    class_index_path = model_dir / "class_index.json"
    class_index_path.write_text(
        json.dumps(train_dataset.class_to_idx, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=int(training_config["batch_size"]),
        shuffle=True,
        num_workers=int(data_config["num_workers"]),
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=int(training_config["batch_size"]),
        shuffle=False,
        num_workers=int(data_config["num_workers"]),
        pin_memory=torch.cuda.is_available(),
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = _build_model(
        architecture=model_config["architecture"],
        num_classes=len(train_dataset.classes),
        pretrained=bool(model_config["pretrained"]),
    ).to(device)
    criterion = _build_criterion(training_config)
    optimizer = _build_optimizer(model.parameters(), training_config)
    scheduler = _build_lr_scheduler(
        optimizer,
        scheduler_config=training_config.get("lr_scheduler"),
        epochs=int(training_config["epochs"]),
    )
    scaler = _create_grad_scaler(
        device,
        mixed_precision=bool(training_config["mixed_precision"]),
        precision_dtype=str(training_config.get("mixed_precision_dtype", "fp16")),
    )

    manifest_path = report_dir / "split_manifest.jsonl"
    write_split_manifest(processed_dir=processed_dir, output_path=manifest_path)
    dataset_summary = build_dataset_summary(raw_dir=raw_dir, processed_dir=processed_dir)

    best_path = model_dir / "best.pt"
    report_path = report_dir / "metrics.json"
    with create_experiment_tracker(config) as tracker:
        tracker.log_json(
            {"config_path": config_path.as_posix(), "config": config},
            "metadata/train_config.json",
        )
        tracker.log_json(git_metadata, "metadata/git.json")
        if git_metadata.get("dirty"):
            diff_path = report_dir / "git.diff"
            diff_path.write_text(collect_git_diff(), encoding="utf-8")
            tracker.log_artifact(diff_path, artifact_path="metadata")
        tracker.log_json(collect_environment_metadata(), "metadata/environment.json")
        tracker.log_json(dataset_summary, "metadata/dataset_summary.json")
        tracker.log_dataset(
            name=str(
                config.get("tracking", {}).get(
                    "dataset_name",
                    "beetle_classifier",
                )
            ),
            summary=dataset_summary,
            source=manifest_path.as_posix(),
            context="training",
        )
        tracker.log_artifact(manifest_path, artifact_path="metadata")

        best_accuracy = 0.0
        for epoch in range(int(training_config["epochs"])):
            _train_epoch(
                model,
                train_loader,
                criterion,
                optimizer,
                scaler,
                device,
                epoch,
                mixed_precision=bool(training_config["mixed_precision"]),
                precision_dtype=str(training_config.get("mixed_precision_dtype", "fp16")),
            )
            if scheduler is not None:
                scheduler.step()
            metrics = evaluate_model(model, val_loader, device, train_dataset.classes)
            tracker.log_metrics(scalar_metrics(metrics), step=epoch + 1)
            if metrics["accuracy"] >= best_accuracy:
                best_accuracy = metrics["accuracy"]
                torch.save(
                    {
                        "model_state": model.state_dict(),
                        "architecture": model_config["architecture"],
                        "classes": train_dataset.classes,
                        "image_size": image_size,
                        "resize_mode": resize_mode,
                        "pad_position": pad_position,
                        "accuracy": best_accuracy,
                    },
                    best_path,
                )

        checkpoint = load_checkpoint(best_path, map_location=device)
        model = _build_model(
            architecture=checkpoint["architecture"],
            num_classes=len(checkpoint["classes"]),
            pretrained=False,
        ).to(device)
        model.load_state_dict(checkpoint["model_state"])
        metrics = evaluate_model(model, val_loader, device, checkpoint["classes"])
        tracker.log_json(scalar_metrics(metrics), "outputs/final_metrics.json")
        report_path.write_text(
            json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        tracker.log_artifact(class_index_path, artifact_path="outputs")
        tracker.log_artifact(report_path, artifact_path="outputs")
        if bool(config.get("tracking", {}).get("log_model", True)):
            tracking_config = config.get("tracking", {})
            tracker.log_model(
                model,
                name=resolve_tracking_name(tracking_config.get("model_name"), config)
                or f"{model_config['architecture']}_beetles",
                metadata={
                    "architecture": checkpoint["architecture"],
                    "image_size": image_size,
                    "resize_mode": resize_mode,
                    "pad_position": pad_position,
                    "class_count": len(checkpoint["classes"]),
                    "accuracy": best_accuracy,
                },
            )
            tracker.log_artifact(best_path, artifact_path="outputs")

    return TrainArtifacts(
        checkpoint_path=best_path,
        class_index_path=class_index_path,
        report_path=report_path,
    )


def evaluate_checkpoint(checkpoint_path: str | Path, data_dir: str | Path) -> dict:
    checkpoint = load_checkpoint(checkpoint_path, map_location="cpu")
    image_size = int(checkpoint["image_size"])
    resize_mode = str(checkpoint.get("resize_mode", "crop"))
    dataset = datasets.ImageFolder(
        data_dir,
        transform=_eval_transforms(image_size, resize_mode=resize_mode),
    )
    loader = DataLoader(dataset, batch_size=64, shuffle=False)
    model = _build_model(
        architecture=checkpoint["architecture"],
        num_classes=len(checkpoint["classes"]),
        pretrained=False,
    )
    model.load_state_dict(checkpoint["model_state"])
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    return evaluate_model(model, loader, device, checkpoint["classes"])


def train_cli() -> None:
    parser = argparse.ArgumentParser(description="Train the Phase 0 classifier.")
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    artifacts = train_from_config(args.config)
    print(json.dumps({key: str(value) for key, value in artifacts.__dict__.items()}, indent=2))


def evaluate_cli() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a Phase 0 classifier checkpoint.")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()
    metrics = evaluate_checkpoint(args.checkpoint, args.data_dir)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


def evaluate_model(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    classes: list[str],
) -> dict:
    model.eval()
    y_true: list[int] = []
    y_pred: list[int] = []
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = inputs.to(device)
            logits = model(inputs)
            predictions = logits.argmax(dim=1).cpu().numpy().tolist()
            y_pred.extend(predictions)
            y_true.extend(labels.numpy().tolist())

    return classification_metrics(y_true, y_pred, classes)


def classification_metrics(y_true: list[int], y_pred: list[int], classes: list[str]) -> dict:
    labels = list(range(len(classes)))
    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        target_names=classes,
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(y_true, y_pred, labels=labels).tolist()
    accuracy = float(np.mean(np.array(y_true) == np.array(y_pred))) if y_true else 0.0
    return {
        "accuracy": accuracy,
        "classification_report": report,
        "confusion_matrix": matrix,
        "classes": classes,
    }


def _ensure_training_branch_allowed(config: dict, git_metadata: dict) -> None:
    tracking_config = config.get("tracking", {})
    if str(tracking_config.get("backend", "none")) != "mlflow":
        return
    required_branch = str(tracking_config.get("required_git_branch", "main"))
    if not required_branch:
        return
    actual_branch = str(git_metadata.get("branch", ""))
    if actual_branch != required_branch:
        raise RuntimeError(
            "MLflow training runs must be executed from "
            f"the {required_branch!r} branch; current branch is {actual_branch!r}."
        )


def _prepare_split(
    *,
    raw_dir: Path,
    processed_dir: Path,
    train_split: float,
    min_images_per_class: int,
    seed: int,
    included_class_dirs: set[str] | None = None,
) -> None:
    if not raw_dir.exists():
        raise FileNotFoundError(f"Raw dataset directory does not exist: {raw_dir}")
    train_dir = processed_dir / "train"
    val_dir = processed_dir / "val"
    if train_dir.exists() and val_dir.exists():
        return

    rng = random.Random(seed)
    class_dirs = sorted(path for path in raw_dir.iterdir() if path.is_dir())
    if included_class_dirs is not None:
        class_dirs = [path for path in class_dirs if path.name in included_class_dirs]
    for class_dir in class_dirs:
        images = [
            path
            for path in sorted(class_dir.iterdir())
            if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        if len(images) < min_images_per_class:
            continue
        rng.shuffle(images)
        split_index = max(1, min(len(images) - 1, int(len(images) * train_split)))
        for split_name, split_images in {
            "train": images[:split_index],
            "val": images[split_index:],
        }.items():
            target_dir = processed_dir / split_name / class_dir.name
            target_dir.mkdir(parents=True, exist_ok=True)
            for image_path in split_images:
                target_path = target_dir / image_path.name
                if not target_path.exists():
                    shutil.copy2(image_path, target_path)


def _load_class_dirs(manifest_path: Path) -> set[str]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != 1 or not isinstance(payload.get("taxa"), list):
        raise ValueError(f"Unsupported taxon manifest: {manifest_path}")
    class_dirs = {
        item["classDirName"]
        for item in payload["taxa"]
        if isinstance(item, dict) and isinstance(item.get("classDirName"), str)
    }
    if not class_dirs:
        raise ValueError(f"Taxon manifest contains no classes: {manifest_path}")
    return class_dirs


def _build_model(*, architecture: str, num_classes: int, pretrained: bool) -> nn.Module:
    if architecture == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
    elif architecture == "mobilenet_v3_large":
        weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_large(weights=weights)
    elif architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b0(weights=weights)
    elif architecture == "convnext_tiny":
        weights = models.ConvNeXt_Tiny_Weights.DEFAULT if pretrained else None
        model = models.convnext_tiny(weights=weights)
    else:
        raise ValueError(f"Unsupported architecture: {architecture}")

    classifier = model.classifier[-1]
    if not isinstance(classifier, nn.Linear):
        raise TypeError(f"Unsupported classifier head for architecture: {architecture}")
    model.classifier[-1] = nn.Linear(classifier.in_features, num_classes)
    return model


def _build_lr_scheduler(
    optimizer: torch.optim.Optimizer,
    *,
    scheduler_config: dict | None,
    epochs: int,
):
    if scheduler_config is None:
        return None

    scheduler_type = str(scheduler_config.get("type", "none"))
    if scheduler_type == "none":
        return None
    if scheduler_type == "cosine":
        return torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer,
            T_max=epochs,
            eta_min=float(scheduler_config.get("min_learning_rate", 0.0)),
        )
    if scheduler_type == "step":
        return torch.optim.lr_scheduler.StepLR(
            optimizer,
            step_size=int(scheduler_config["step_size"]),
            gamma=float(scheduler_config["gamma"]),
        )
    raise ValueError("training.lr_scheduler.type must be none, cosine, or step")


def _build_optimizer(parameters, training_config: dict) -> torch.optim.Optimizer:
    optimizer_type = str(training_config.get("optimizer", "adamw")).lower()
    learning_rate = float(training_config["learning_rate"])
    weight_decay = float(training_config["weight_decay"])
    if optimizer_type == "adamw":
        return torch.optim.AdamW(parameters, lr=learning_rate, weight_decay=weight_decay)
    if optimizer_type == "sgd":
        return torch.optim.SGD(
            parameters,
            lr=learning_rate,
            momentum=float(training_config.get("momentum", 0.9)),
            weight_decay=weight_decay,
        )
    raise ValueError("training.optimizer must be adamw or sgd")


def _build_criterion(training_config: dict) -> nn.Module:
    return nn.CrossEntropyLoss(label_smoothing=float(training_config.get("label_smoothing", 0.0)))


def _train_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    scaler: torch.amp.GradScaler,
    device: torch.device,
    epoch: int,
    mixed_precision: bool,
    precision_dtype: str,
) -> None:
    model.train()
    progress = tqdm(loader, desc=f"epoch {epoch + 1}")
    for inputs, labels in progress:
        inputs = inputs.to(device)
        labels = labels.to(device)
        optimizer.zero_grad(set_to_none=True)
        with _autocast_context(
            device,
            enabled=mixed_precision and device.type == "cuda",
            precision_dtype=precision_dtype,
        ):
            logits = model(inputs)
            loss = criterion(logits, labels)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        progress.set_postfix(loss=float(loss.detach().cpu()))


def _create_grad_scaler(
    device: torch.device,
    *,
    mixed_precision: bool,
    precision_dtype: str,
) -> torch.amp.GradScaler:
    _resolve_amp_dtype(precision_dtype)
    return torch.amp.GradScaler(
        device.type,
        enabled=mixed_precision and device.type == "cuda" and precision_dtype == "fp16",
    )


def _autocast_context(device: torch.device, *, enabled: bool, precision_dtype: str):
    return torch.amp.autocast(
        device_type=device.type,
        enabled=enabled,
        dtype=_resolve_amp_dtype(precision_dtype),
    )


def _resolve_amp_dtype(precision_dtype: str) -> torch.dtype:
    if precision_dtype == "fp16":
        return torch.float16
    if precision_dtype == "bf16":
        return torch.bfloat16
    raise ValueError("training.mixed_precision_dtype must be fp16 or bf16")


class AspectRatioPadResize:
    def __init__(
        self,
        image_size: int,
        *,
        scale: tuple[float, float] = (1.0, 1.0),
        random_position: bool = False,
        fill: tuple[int, int, int] = (124, 116, 104),
    ) -> None:
        self.image_size = int(image_size)
        self.scale = scale
        self.random_position = random_position
        self.fill = fill

    def __call__(self, image: Image.Image) -> Image.Image:
        image = image.convert("RGB")
        width, height = image.size
        if width <= 0 or height <= 0:
            raise ValueError("image dimensions must be positive")

        min_scale, max_scale = self.scale
        target_long_edge = self.image_size * random.uniform(min_scale, max_scale)
        resize_ratio = target_long_edge / max(width, height)
        resized_width = max(1, min(self.image_size, int(round(width * resize_ratio))))
        resized_height = max(1, min(self.image_size, int(round(height * resize_ratio))))
        resized = image.resize((resized_width, resized_height), Image.Resampling.BILINEAR)

        canvas = Image.new("RGB", (self.image_size, self.image_size), self.fill)
        max_x = self.image_size - resized_width
        max_y = self.image_size - resized_height
        if self.random_position:
            offset = (random.randint(0, max_x), random.randint(0, max_y))
        else:
            offset = (max_x // 2, max_y // 2)
        canvas.paste(resized, offset)
        return canvas


def _train_transforms(
    image_size: int,
    augmentation_config: dict | None = None,
    *,
    resize_mode: str = "crop",
    pad_position: str = "random",
):
    augmentation_config = augmentation_config or {}
    crop_scale = augmentation_config.get("random_resized_crop_scale", [0.6, 1.0])
    resize_mode = str(resize_mode)
    if resize_mode == "crop":
        transform_steps = [
            transforms.RandomResizedCrop(
                image_size,
                scale=tuple(float(value) for value in crop_scale),
            ),
            transforms.RandomHorizontalFlip(),
        ]
    elif resize_mode == "pad":
        if pad_position not in {"random", "center"}:
            raise ValueError("data.pad_position must be random or center")
        transform_steps = [
            AspectRatioPadResize(
                image_size,
                scale=tuple(float(value) for value in crop_scale),
                random_position=pad_position == "random",
            ),
            transforms.RandomHorizontalFlip(),
        ]
    else:
        raise ValueError("data.resize_mode must be crop or pad")

    if augmentation_config.get("vertical_flip"):
        transform_steps.append(transforms.RandomVerticalFlip())

    if rotation_degrees := augmentation_config.get("rotation_degrees"):
        transform_steps.append(transforms.RandomRotation(float(rotation_degrees)))

    auto_augment_config = augmentation_config.get("auto_augment")
    if auto_augment_config:
        auto_augment_type = str(auto_augment_config.get("type", "none"))
        if auto_augment_type == "trivial":
            transform_steps.append(transforms.TrivialAugmentWide())
        elif auto_augment_type == "randaugment":
            transform_steps.append(
                transforms.RandAugment(
                    num_ops=int(auto_augment_config.get("num_ops", 2)),
                    magnitude=int(auto_augment_config.get("magnitude", 9)),
                )
            )
        elif auto_augment_type != "none":
            raise ValueError(
                "data.augmentation.auto_augment.type must be none, trivial, or randaugment"
            )

    color_jitter_config = augmentation_config.get(
        "color_jitter",
        {"brightness": 0.2, "contrast": 0.2, "saturation": 0.2},
    )
    if color_jitter_config:
        transform_steps.append(
            transforms.ColorJitter(
                brightness=float(color_jitter_config.get("brightness", 0.0)),
                contrast=float(color_jitter_config.get("contrast", 0.0)),
                saturation=float(color_jitter_config.get("saturation", 0.0)),
                hue=float(color_jitter_config.get("hue", 0.0)),
            )
        )

    transform_steps.extend(
        [
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )
    random_erasing_config = augmentation_config.get("random_erasing")
    if random_erasing_config:
        transform_steps.append(
            transforms.RandomErasing(
                p=float(random_erasing_config.get("p", 0.25)),
                scale=tuple(
                    float(value) for value in random_erasing_config.get("scale", [0.02, 0.1])
                ),
                ratio=tuple(
                    float(value) for value in random_erasing_config.get("ratio", [0.3, 3.3])
                ),
            )
        )
    return transforms.Compose(transform_steps)


def _eval_transforms(image_size: int, *, resize_mode: str = "crop"):
    return transforms.Compose(
        [
            *_eval_geometry_transforms(image_size, resize_mode=resize_mode),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def _eval_geometry_transforms(image_size: int, *, resize_mode: str = "crop"):
    resize_mode = str(resize_mode)
    if resize_mode == "crop":
        return [
            transforms.Resize(int(image_size * 1.15)),
            transforms.CenterCrop(image_size),
        ]
    if resize_mode == "pad":
        return [AspectRatioPadResize(image_size)]
    raise ValueError("data.resize_mode must be crop or pad")


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
