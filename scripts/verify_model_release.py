"""Verify a model release bundle before it can be published to R2."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(manifest_path: Path, model_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text())
    required = {"version", "modelUrl", "sha256", "license", "source", "classes"}
    missing = sorted(required - manifest.keys())
    if missing:
        raise ValueError(f"Manifest is missing: {', '.join(missing)}")
    if manifest["license"].strip().upper() == "UNPUBLISHED":
        raise ValueError("Model license must be resolved before deployment")
    if Path(urlparse(manifest["modelUrl"]).path).name != model_path.name:
        raise ValueError("Manifest modelUrl does not match the model filename")
    if manifest["sha256"].lower() != sha256(model_path):
        raise ValueError("Model SHA-256 does not match the manifest")
    if not manifest["classes"]:
        raise ValueError("Manifest classes must not be empty")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("model", type=Path)
    arguments = parser.parse_args()
    verify(arguments.manifest, arguments.model)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
