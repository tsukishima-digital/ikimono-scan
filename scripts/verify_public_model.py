"""Verify that the public model bytes match the tracked release manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urljoin

DEFAULT_PUBLIC_BASE_URL = "https://ikimono-scan.app/"


def verify_public_model(
    manifest_path: Path,
    *,
    public_base_url: str = DEFAULT_PUBLIC_BASE_URL,
    download: Callable[[str], bytes] | None = None,
) -> str:
    """Download the manifest's public model URL and verify its SHA-256."""

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    public_url = urljoin(public_base_url.rstrip("/") + "/", manifest["modelUrl"])
    model_bytes = (download or _download_with_retries)(public_url)
    if hashlib.sha256(model_bytes).hexdigest() != manifest["sha256"].lower():
        raise ValueError("The public model SHA-256 does not match the manifest")
    return public_url


def _download_with_retries(url: str) -> bytes:
    last_error: Exception | None = None
    for _ in range(6):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(2)
    raise RuntimeError("Could not download the public model") from last_error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--public-base-url", default=DEFAULT_PUBLIC_BASE_URL)
    args = parser.parse_args()
    public_url = verify_public_model(
        args.manifest,
        public_base_url=args.public_base_url,
    )
    print(f"Verified public model: {public_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
