import json
from pathlib import Path

from PIL import Image

from scripts.build_species_gallery import (
    ALLOWED_PHOTO_LICENSES,
    build_observation_params,
    catalog_entry,
    select_photo,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _photo(
    photo_id: int,
    license_code: str | None,
    *,
    attribution: str = "(c) observer, some rights reserved",
) -> dict:
    return {
        "id": photo_id,
        "url": f"https://example.org/photos/{photo_id}/square.jpg",
        "license_code": license_code,
        "attribution": attribution,
    }


def test_gallery_search_requests_representative_japanese_observations() -> None:
    params = build_observation_params(taxon_id=494519)

    assert params == {
        "taxon_id": 494519,
        "place_id": 6737,
        "quality_grade": "research",
        "photos": "true",
        "photo_license": "cc0,cc-by,cc-by-nc",
        "order_by": "votes",
        "order": "desc",
        "per_page": 30,
    }
    assert "place_id" not in build_observation_params(taxon_id=494519, place_id=None)


def test_gallery_accepts_photo_level_licenses_supported_by_the_noncommercial_site() -> None:
    observations = [
        {
            "id": 10,
            "photos": [
                _photo(100, "cc-by-nc"),
                _photo(101, None),
            ],
        }
    ]

    selection = select_photo(observations)

    assert selection is not None
    assert selection.photo_id == 100
    assert selection.observation_id == 10
    assert selection.license_code == "cc-by-nc"
    assert set(ALLOWED_PHOTO_LICENSES) == {"cc0", "cc-by", "cc-by-nc"}


def test_gallery_skips_observations_without_usable_photos() -> None:
    observations = [
        {"id": 10, "photos": [_photo(100, "cc-by-nc-nd")]},
        {"id": 11, "photos": [_photo(101, None)]},
    ]

    assert select_photo(observations) is None


def test_catalog_entry_keeps_photo_provenance_and_same_origin_asset() -> None:
    selection = select_photo([{"id": 10, "photos": [_photo(101, "cc-by", attribution="Example")]}])
    assert selection is not None

    assert catalog_entry(
        taxon_id=494519,
        selection=selection,
        width=512,
        height=384,
    ) == {
        "photoUrl": "/species/494519.webp",
        "photoId": 101,
        "observationId": 10,
        "sourcePhotoUrl": "https://www.inaturalist.org/photos/101",
        "attribution": "Example",
        "license": "CC BY",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "width": 512,
        "height": 384,
    }


def test_catalog_entry_records_the_noncommercial_license() -> None:
    selection = select_photo(
        [{"id": 10, "photos": [_photo(101, "cc-by-nc", attribution="Example")]}]
    )
    assert selection is not None

    entry = catalog_entry(
        taxon_id=735392,
        selection=selection,
        width=512,
        height=384,
    )

    assert entry["license"] == "CC BY-NC"
    assert entry["licenseUrl"] == "https://creativecommons.org/licenses/by-nc/4.0/"


def test_committed_gallery_covers_every_supported_species() -> None:
    manifest = json.loads(
        (REPOSITORY_ROOT / "web/public/models/manifest.json").read_text(encoding="utf-8")
    )
    catalog = json.loads(
        (REPOSITORY_ROOT / "web/src/content/species-photos.json").read_text(encoding="utf-8")
    )
    expected_ids = {item["id"] for item in manifest["classes"]}

    assert set(catalog["photos"]) | set(catalog["missing"]) == expected_ids
    assert set(catalog["photos"]).isdisjoint(catalog["missing"])
    assert catalog["missing"] == []
    for taxon_id, photo in catalog["photos"].items():
        assert photo["license"] in {"CC0", "CC BY", "CC BY-NC"}
        assert photo["sourcePhotoUrl"].endswith(f"/photos/{photo['photoId']}")
        assert photo["width"] <= 512
        assert photo["height"] <= 512
        asset = REPOSITORY_ROOT / f"web/public/species/{taxon_id}.webp"
        assert asset.is_file()
        assert asset.stat().st_size > 0
        with Image.open(asset) as image:
            assert image.format == "WEBP"
            assert list(image.size) == [photo["width"], photo["height"]]
