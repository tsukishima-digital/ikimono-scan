import json

import pytest

from scripts.check_external_links import load_external_links


def test_load_external_links_accepts_named_https_urls(tmp_path) -> None:
    path = tmp_path / "external-links.json"
    path.write_text(
        json.dumps({"environmentMinistryAromia": "https://example.com/reference"}),
        encoding="utf-8",
    )

    assert load_external_links(path) == {
        "environmentMinistryAromia": "https://example.com/reference"
    }


@pytest.mark.parametrize(
    "payload",
    [[], {"reference": "http://example.com"}, {"reference": 123}],
)
def test_load_external_links_rejects_an_unsafe_catalog(tmp_path, payload) -> None:
    path = tmp_path / "external-links.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="HTTPS URL"):
        load_external_links(path)
