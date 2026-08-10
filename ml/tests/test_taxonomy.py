import json
from pathlib import Path

from ikimono_scan_ml.taxonomy import _taxon_id


def test_taxon_id_uses_the_stable_inaturalist_identifier() -> None:
    assert _taxon_id("494519_aromia_bungii") == "494519"


def test_taxon_id_rejects_an_unlinked_class_label() -> None:
    try:
        _taxon_id("aromia_bungii")
    except ValueError as error:
        assert "Unsupported class label" in str(error)
    else:
        raise AssertionError("Expected a class label without a taxon ID to fail")


def test_japanese_catalog_covers_the_current_release_classes() -> None:
    catalog_path = Path(__file__).parents[1] / "taxonomy" / "ja.json"
    taxa = json.loads(catalog_path.read_text(encoding="utf-8"))["taxa"]

    assert len(taxa) == 422
    assert taxa["494519"]["commonName"] == "クビアカツヤカミキリ"
    assert taxa["499267"]["commonName"] == "ガムシ"
