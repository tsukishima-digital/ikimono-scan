from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import torch

from ikimono_scan_ml.training import _build_model

# Business: Suppress low-confidence closed-set labels until negative-image evaluation
# provides a calibrated rejection policy.
DEFAULT_MINIMUM_CONFIDENCE = 0.6
DEFAULT_TAXONOMY_CATALOG_PATH = Path(__file__).resolve().parents[1] / "taxonomy" / "ja.json"


@dataclass(frozen=True)
class WebExportArtifacts:
    model_path: Path
    manifest_path: Path


def export_checkpoint(
    *,
    checkpoint_path: str | Path,
    output_dir: str | Path,
    version: str,
    license_name: str,
    source: str,
    taxonomy_catalog_path: str | Path | None = DEFAULT_TAXONOMY_CATALOG_PATH,
) -> WebExportArtifacts:
    checkpoint_path = Path(checkpoint_path)
    output_dir = Path(output_dir)
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    classes = list(checkpoint["classes"])
    image_size = int(checkpoint["image_size"])
    model = _build_model(
        architecture=str(checkpoint["architecture"]),
        num_classes=len(classes),
        pretrained=False,
    )
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"beetles-v{version}.onnx"
    torch.onnx.export(
        model,
        torch.zeros(1, 3, image_size, image_size),
        model_path,
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
    taxonomy_catalog = _load_taxonomy_catalog(taxonomy_catalog_path)
    manifest = build_manifest(
        classes=classes,
        taxonomy_catalog=taxonomy_catalog,
        image_size=image_size,
        model_url=f"/models/{model_path.name}",
        sha256=sha256,
        version=version,
        license_name=license_name,
        source=source,
    )
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return WebExportArtifacts(model_path=model_path, manifest_path=manifest_path)


def build_manifest(
    *,
    classes: list[str],
    taxonomy_catalog: dict[str, dict[str, str]] | None = None,
    image_size: int,
    model_url: str,
    sha256: str,
    version: str,
    license_name: str,
    source: str,
) -> dict:
    return {
        "version": version,
        "modelUrl": model_url,
        "sha256": sha256,
        "license": license_name,
        "source": source,
        "imageSize": image_size,
        "inputName": "input",
        "outputName": "logits",
        "minimumConfidence": DEFAULT_MINIMUM_CONFIDENCE,
        "classes": [_manifest_class(label, taxonomy_catalog or {}) for label in classes],
    }


def _manifest_class(label: str, taxonomy_catalog: dict[str, dict[str, str]]) -> dict[str, str]:
    taxon_id, separator, scientific_slug = label.partition("_")
    if not separator or not taxon_id.isdigit() or "_" not in scientific_slug:
        raise ValueError(f"Unsupported class label: {label}")
    name_parts = scientific_slug.split("_")
    result = {
        "id": taxon_id,
        "scientificName": " ".join([name_parts[0].capitalize(), *name_parts[1:]]),
    }
    common_name = taxonomy_catalog.get(taxon_id, {}).get("commonName")
    if common_name:
        result["commonName"] = common_name
    return result


def _load_taxonomy_catalog(
    path: str | Path | None,
) -> dict[str, dict[str, str]]:
    if path is None:
        return {}
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    taxa = payload.get("taxa")
    if not isinstance(taxa, dict):
        raise ValueError("Taxonomy catalog must contain a taxa object")
    return taxa


def export_web_cli() -> None:
    parser = argparse.ArgumentParser(description="Export a checkpoint for browser inference.")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--license", required=True, dest="license_name")
    parser.add_argument("--source", required=True)
    parser.add_argument(
        "--taxonomy-catalog",
        default=str(DEFAULT_TAXONOMY_CATALOG_PATH),
    )
    args = parser.parse_args()
    artifacts = export_checkpoint(
        checkpoint_path=args.checkpoint,
        output_dir=args.output_dir,
        version=args.version,
        license_name=args.license_name,
        source=args.source,
        taxonomy_catalog_path=args.taxonomy_catalog,
    )
    print(json.dumps({key: str(value) for key, value in artifacts.__dict__.items()}, indent=2))
