import io

from ikimono_scan_ml import inat
from ikimono_scan_ml.inat import (
    Taxon,
    _download_first_photo,
    _observation_search_params,
)
from PIL import Image

TAXON = Taxon(1, "Aromia bungii", "クビアカツヤカミキリ", 12)


def _observation(license_code: str | None, *, photo_license: str | None = None) -> dict:
    return {
        "id": 100,
        "license_code": license_code,
        "photos": [
            {
                "id": 200,
                "url": "https://example.org/photos/200/square.jpg",
                "license_code": photo_license,
                "attribution": "(c) observer, some rights reserved (CC BY)",
            }
        ],
    }


class _FakeResponse:
    def __init__(self, content: bytes) -> None:
        self.content = content

    def raise_for_status(self) -> None:
        return None


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_observation_search_params_include_photo_license_filter() -> None:
    params = _observation_search_params(
        place={"id": 6737},
        filters={
            "quality_grade": "research",
            "photos": True,
            "allowed_photo_licenses": ["cc0", "cc-by"],
        },
        taxon_id=1,
    )

    assert params["photo_license"] == "cc0,cc-by"
    assert params["taxon_id"] == 1
    assert params["place_id"] == 6737


def test_observation_search_params_without_license_filter() -> None:
    params = _observation_search_params(
        place={"id": 6737},
        filters={"quality_grade": "research", "photos": True},
        taxon_id=1,
    )

    assert "photo_license" not in params


def test_download_skips_photo_with_disallowed_license(tmp_path) -> None:
    metadata = _download_first_photo(
        _observation("cc-by-nc"),
        TAXON,
        "target",
        tmp_path,
        allowed_licenses={"cc0", "cc-by"},
    )

    assert metadata is None
    assert list(tmp_path.iterdir()) == []


def test_download_skips_photo_without_license_when_filter_active(tmp_path) -> None:
    metadata = _download_first_photo(
        _observation(None),
        TAXON,
        "target",
        tmp_path,
        allowed_licenses={"cc0", "cc-by"},
    )

    assert metadata is None


def test_download_keeps_allowed_license_and_records_attribution(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        inat,
        "_get_with_retries",
        lambda session, url, *, params, timeout_seconds: _FakeResponse(_png_bytes()),
    )

    metadata = _download_first_photo(
        _observation("cc-by"),
        TAXON,
        "target",
        tmp_path,
        allowed_licenses={"cc0", "cc-by"},
    )

    assert metadata is not None
    assert metadata["license_code"] == "cc-by"
    assert metadata["attribution"] == "(c) observer, some rights reserved (CC BY)"


def test_photo_level_license_takes_precedence_over_observation(tmp_path) -> None:
    # 観察全体が CC0 でも、写真自体が NC なら除外する
    metadata = _download_first_photo(
        _observation("cc0", photo_license="cc-by-nc"),
        TAXON,
        "target",
        tmp_path,
        allowed_licenses={"cc0", "cc-by"},
    )

    assert metadata is None


def test_download_without_filter_keeps_any_license(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        inat,
        "_get_with_retries",
        lambda session, url, *, params, timeout_seconds: _FakeResponse(_png_bytes()),
    )

    metadata = _download_first_photo(_observation("cc-by-nc"), TAXON, "target", tmp_path)

    assert metadata is not None
    assert metadata["license_code"] == "cc-by-nc"
