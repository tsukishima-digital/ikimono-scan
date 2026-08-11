"""Upload a verified ONNX model to R2 and stage its manifest for deployment."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

if __package__:
    from scripts.verify_model_release import verify
else:
    from verify_model_release import verify

REPOSITORY_ROOT = Path(__file__).parents[1]
DEFAULT_BUCKET = "ikimono-scan-models"
DEFAULT_TRACKED_MANIFEST = REPOSITORY_ROOT / "web/public/models/manifest.json"


class ModelRemote(Protocol):
    def object_exists(self, key: str) -> bool: ...

    def upload(self, model: Path, key: str) -> None: ...

    def download_sha256(self, key: str) -> str: ...


class WranglerR2Remote:
    """Access the production model bucket through the local Wrangler login."""

    def __init__(self, *, bucket: str) -> None:
        self.bucket = bucket

    def object_exists(self, key: str) -> bool:
        result = self._get(key)
        if result.returncode == 0:
            return True
        if b"specified key does not exist" in result.stderr:
            return False
        raise RuntimeError(result.stderr.decode(errors="replace").strip())

    def upload(self, model: Path, key: str) -> None:
        subprocess.run(
            [
                "npm",
                "--prefix",
                "web",
                "exec",
                "--",
                "wrangler",
                "r2",
                "object",
                "put",
                f"{self.bucket}/{key}",
                "--remote",
                "--file",
                str(model.resolve()),
                "--content-type",
                "application/octet-stream",
                "--cache-control",
                "public, max-age=31536000, immutable",
            ],
            cwd=REPOSITORY_ROOT,
            check=True,
        )

    def download_sha256(self, key: str) -> str:
        result = self._get(key)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode(errors="replace").strip())
        return hashlib.sha256(result.stdout).hexdigest()

    def _get(self, key: str) -> subprocess.CompletedProcess[bytes]:
        return subprocess.run(
            [
                "npm",
                "--prefix",
                "web",
                "exec",
                "--",
                "wrangler",
                "r2",
                "object",
                "get",
                f"{self.bucket}/{key}",
                "--remote",
                "--pipe",
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            check=False,
        )


class ModelPublisher:
    def __init__(self, *, remote: ModelRemote) -> None:
        self.remote = remote

    def publish(
        self,
        *,
        manifest_path: Path,
        model_path: Path,
        tracked_manifest_path: Path,
    ) -> None:
        verify(manifest_path, model_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if self.remote.object_exists(model_path.name):
            raise ValueError(f"Published model already exists: {model_path.name}")

        self.remote.upload(model_path, model_path.name)
        if self.remote.download_sha256(model_path.name) != manifest["sha256"].lower():
            raise ValueError("The remote model SHA-256 does not match the manifest")

        tracked_manifest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(manifest_path, tracked_manifest_path)


def _model_path(manifest_path: Path) -> Path:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    filename = Path(urlparse(manifest["modelUrl"]).path).name
    return manifest_path.parent / filename


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upload a verified ONNX model and stage its manifest for deployment."
    )
    parser.add_argument("--bundle-dir", required=True, type=Path)
    parser.add_argument("--bucket", default=DEFAULT_BUCKET)
    parser.add_argument("--tracked-manifest", type=Path, default=DEFAULT_TRACKED_MANIFEST)
    args = parser.parse_args()

    manifest_path = args.bundle_dir / "manifest.json"
    model_path = _model_path(manifest_path)
    publisher = ModelPublisher(
        remote=WranglerR2Remote(bucket=args.bucket),
    )
    publisher.publish(
        manifest_path=manifest_path,
        model_path=model_path,
        tracked_manifest_path=args.tracked_manifest,
    )
    print(f"Uploaded {model_path.name}; staged {args.tracked_manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
