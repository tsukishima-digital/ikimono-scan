from __future__ import annotations

import argparse
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageOps

ALLOWED_PHOTO_LICENSES = ("cc0", "cc-by")
INATURALIST_API_URL = "https://api.inaturalist.org/v1"
JAPAN_PLACE_ID = 6737
LICENSE_DETAILS = {
    "cc0": ("CC0", "https://creativecommons.org/publicdomain/zero/1.0/"),
    "cc-by": ("CC BY", "https://creativecommons.org/licenses/by/4.0/"),
}
USER_AGENT = "Ikimono Scan species gallery (https://github.com/tsukishima-digital/ikimono-scan)"


@dataclass(frozen=True)
class PhotoSelection:
    photo_id: int
    observation_id: int
    image_url: str
    attribution: str
    license_code: str


def build_observation_params(
    *, taxon_id: int, place_id: int | None = JAPAN_PLACE_ID
) -> dict[str, Any]:
    params = {
        "taxon_id": taxon_id,
        "quality_grade": "research",
        "photos": "true",
        "photo_license": ",".join(ALLOWED_PHOTO_LICENSES),
        "order_by": "votes",
        "order": "desc",
        "per_page": 30,
    }
    if place_id is not None:
        params["place_id"] = place_id
    return params


def select_photo(observations: list[dict[str, Any]]) -> PhotoSelection | None:
    for observation in observations:
        observation_id = observation.get("id")
        if not isinstance(observation_id, int):
            continue
        for photo in observation.get("photos") or []:
            license_code = photo.get("license_code")
            if license_code not in ALLOWED_PHOTO_LICENSES:
                continue
            photo_id = photo.get("id")
            image_url = photo.get("url")
            attribution = photo.get("attribution")
            if not (
                isinstance(photo_id, int)
                and isinstance(image_url, str)
                and isinstance(attribution, str)
                and attribution
            ):
                continue
            return PhotoSelection(
                photo_id=photo_id,
                observation_id=observation_id,
                image_url=_large_photo_url(image_url),
                attribution=attribution,
                license_code=license_code,
            )
    return None


def catalog_entry(
    *,
    taxon_id: int,
    selection: PhotoSelection,
    width: int,
    height: int,
) -> dict[str, Any]:
    license_name, license_url = LICENSE_DETAILS[selection.license_code]
    return {
        "photoUrl": f"/species/{taxon_id}.webp",
        "photoId": selection.photo_id,
        "observationId": selection.observation_id,
        "sourcePhotoUrl": f"https://www.inaturalist.org/photos/{selection.photo_id}",
        "attribution": selection.attribution,
        "license": license_name,
        "licenseUrl": license_url,
        "width": width,
        "height": height,
    }


def build_gallery(
    *,
    manifest_path: Path,
    output_dir: Path,
    catalog_path: Path,
    request_sleep_seconds: float,
    image_size: int,
    image_quality: int,
    download_workers: int,
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    classes = manifest.get("classes")
    if not isinstance(classes, list):
        raise ValueError("Model manifest classes must be a list")

    output_dir.mkdir(parents=True, exist_ok=True)
    catalog = _load_catalog(catalog_path)
    photos = catalog["photos"]
    missing = set(catalog["missing"])
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    last_api_request_at = 0.0
    pending_downloads = {}

    def request_observations(*, taxon_id: int, place_id: int | None) -> list[dict[str, Any]]:
        nonlocal last_api_request_at
        elapsed = time.monotonic() - last_api_request_at
        if elapsed < request_sleep_seconds:
            time.sleep(request_sleep_seconds - elapsed)
        response = session.get(
            f"{INATURALIST_API_URL}/observations",
            params=build_observation_params(taxon_id=taxon_id, place_id=place_id),
            timeout=30,
        )
        last_api_request_at = time.monotonic()
        response.raise_for_status()
        payload = response.json()
        return payload.get("results") or []

    with ThreadPoolExecutor(max_workers=download_workers) as executor:
        for index, class_info in enumerate(classes):
            taxon_id = int(class_info["id"])
            destination = output_dir / f"{taxon_id}.webp"
            if (str(taxon_id) in photos and destination.is_file()) or str(taxon_id) in missing:
                continue

            selection = select_photo(
                request_observations(taxon_id=taxon_id, place_id=JAPAN_PLACE_ID)
            )
            if selection is None:
                selection = select_photo(request_observations(taxon_id=taxon_id, place_id=None))
            if selection is None:
                missing.add(str(taxon_id))
                catalog["missing"] = sorted(missing, key=int)
                _write_catalog(catalog_path, catalog)
                print(
                    f"No CC0/CC BY photo found for {taxon_id}",
                    flush=True,
                )
                continue

            future = executor.submit(
                _download_and_optimize,
                selection.image_url,
                destination,
                image_size=image_size,
                image_quality=image_quality,
            )
            pending_downloads[future] = (index, taxon_id, selection)

        for future in as_completed(pending_downloads):
            index, taxon_id, selection = pending_downloads[future]
            width, height = future.result()
            photos[str(taxon_id)] = catalog_entry(
                taxon_id=taxon_id,
                selection=selection,
                width=width,
                height=height,
            )
            _write_catalog(catalog_path, catalog)
            print(
                f"[{index + 1}/{len(classes)}] {taxon_id}: photo {selection.photo_id}",
                flush=True,
            )

    _write_catalog(catalog_path, catalog)


def _large_photo_url(url: str) -> str:
    for size in ("square", "small", "medium"):
        marker = f"/{size}."
        if marker in url:
            return url.replace(marker, "/large.")
    return url


def _download_and_optimize(
    url: str,
    destination: Path,
    *,
    image_size: int,
    image_quality: int,
) -> tuple[int, int]:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()
    with Image.open(io.BytesIO(response.content)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((image_size, image_size), Image.Resampling.LANCZOS)
        image.save(
            destination,
            format="WEBP",
            quality=image_quality,
            method=6,
        )
        return image.size


def _load_catalog(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"version": 1, "photos": {}, "missing": []}
    catalog = json.loads(path.read_text(encoding="utf-8"))
    if catalog.get("version") != 1 or not isinstance(catalog.get("photos"), dict):
        raise ValueError("Unsupported species photo catalog")
    if not isinstance(catalog.get("missing"), list):
        catalog["missing"] = []
    return catalog


def _write_catalog(path: Path, catalog: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the licensed image catalog for the supported species gallery."
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("web/public/models/manifest.json"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("web/public/species"),
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("web/src/content/species-photos.json"),
    )
    parser.add_argument("--request-sleep", type=float, default=1.05)
    parser.add_argument("--image-size", type=int, default=512)
    parser.add_argument("--image-quality", type=int, default=65)
    parser.add_argument("--download-workers", type=int, default=6)
    args = parser.parse_args()

    build_gallery(
        manifest_path=args.manifest,
        output_dir=args.output_dir,
        catalog_path=args.catalog,
        request_sleep_seconds=args.request_sleep,
        image_size=args.image_size,
        image_quality=args.image_quality,
        download_workers=args.download_workers,
    )


if __name__ == "__main__":
    main()
