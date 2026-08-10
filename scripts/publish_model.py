"""Upload a verified ONNX model to R2 and stage its manifest for deployment."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Protocol
from urllib.parse import urljoin, urlparse

if __package__:
    from scripts.verify_model_release import verify
else:
    from verify_model_release import verify

REPOSITORY_ROOT = Path(__file__).parents[1]
DEFAULT_BUCKET = "ikimono-scan-models"
DEFAULT_PUBLIC_BASE_URL = "https://ikimono-scan.app/models/"
DEFAULT_TRACKED_MANIFEST = REPOSITORY_ROOT / "web/public/models/manifest.json"


class ModelRemote(Protocol):
    def object_exists(self, url: str) -> bool: ...

    def upload(self, model: Path, key: str) -> None: ...

    def download_sha256(self, url: str) -> str: ...


class WranglerR2Remote:
    """Access the production model bucket through the local Wrangler login."""

    def __init__(self, *, bucket: str, public_base_url: str) -> None:
        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/") + "/"

    def object_exists(self, url: str) -> bool:
        request = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status == 200
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return False
            raise RuntimeError(f"Could not check published model: HTTP {error.code}") from error

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

    def download_sha256(self, url: str) -> str:
        last_error: Exception | None = None
        for _ in range(6):
            digest = hashlib.sha256()
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    for chunk in iter(lambda: response.read(1024 * 1024), b""):
                        digest.update(chunk)
                return digest.hexdigest()
            except (urllib.error.URLError, TimeoutError) as error:
                last_error = error
                time.sleep(2)
        raise RuntimeError("Could not verify the uploaded model") from last_error


class ModelPublisher:
    def __init__(
        self,
        *,
        remote: ModelRemote,
        public_base_url: str = DEFAULT_PUBLIC_BASE_URL,
    ) -> None:
        self.remote = remote
        self.public_base_url = public_base_url.rstrip("/") + "/"

    def publish(
        self,
        *,
        manifest_path: Path,
        model_path: Path,
        tracked_manifest_path: Path,
    ) -> None:
        verify(manifest_path, model_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        public_url = urljoin(self.public_base_url, model_path.name)
        if self.remote.object_exists(public_url):
            raise ValueError(f"Published model already exists: {public_url}")

        self.remote.upload(model_path, model_path.name)
        if self.remote.download_sha256(public_url) != manifest["sha256"].lower():
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
    parser.add_argument("--public-base-url", default=DEFAULT_PUBLIC_BASE_URL)
    parser.add_argument("--tracked-manifest", type=Path, default=DEFAULT_TRACKED_MANIFEST)
    args = parser.parse_args()

    manifest_path = args.bundle_dir / "manifest.json"
    model_path = _model_path(manifest_path)
    publisher = ModelPublisher(
        remote=WranglerR2Remote(
            bucket=args.bucket,
            public_base_url=args.public_base_url,
        ),
        public_base_url=args.public_base_url,
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
