import json

from scripts import check_species_status_sources


def test_normalized_html_fingerprint_ignores_markup_and_whitespace() -> None:
    first = b"<html><body><h1>Official list</h1><p>Aromia bungii</p></body></html>"
    second = b"<html>\n<body><h1> Official list </h1> <p>Aromia bungii</p></body>\n</html>"

    assert check_species_status_sources.fingerprint(
        first
    ) == check_species_status_sources.fingerprint(second)


def test_check_sources_reports_only_changed_content(monkeypatch) -> None:
    unchanged = b"<main>unchanged</main>"
    changed = b"<main>changed</main>"
    registry = _registry(
        {
            "stable": check_species_status_sources.fingerprint(unchanged),
            "changed": "a" * 64,
        }
    )
    responses = {
        "https://example.go.jp/stable": unchanged,
        "https://example.go.jp/changed": changed,
    }
    monkeypatch.setattr(check_species_status_sources, "fetch", responses.__getitem__)

    results = check_species_status_sources.check_sources(registry)

    assert [item["sourceId"] for item in results] == ["changed"]
    assert results[0]["actualSha256"] == check_species_status_sources.fingerprint(changed)


def test_refresh_updates_only_source_fingerprints(tmp_path, monkeypatch) -> None:
    content = b"<main>new official list</main>"
    path = tmp_path / "species-status-registry.json"
    path.write_text(json.dumps(_registry({"source": "a" * 64})), encoding="utf-8")
    monkeypatch.setattr(check_species_status_sources, "fetch", lambda _: content)

    check_species_status_sources.refresh(path, checked_on="2026-08-14")

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["sources"][0]["monitor"] == {
        "mode": "normalized_text_sha256",
        "sha256": check_species_status_sources.fingerprint(content),
        "checkedOn": "2026-08-14",
    }


def _registry(fingerprints: dict[str, str]) -> dict:
    return {
        "schemaVersion": 1,
        "registryType": "species_status_and_control_programs",
        "jurisdiction": "JP",
        "sources": [
            {
                "id": source_id,
                "name": source_id,
                "url": f"https://example.go.jp/{source_id}",
                "monitor": {
                    "mode": "normalized_text_sha256",
                    "sha256": sha256,
                },
            }
            for source_id, sha256 in fingerprints.items()
        ],
        "officialDesignations": [],
        "taxa": [],
        "controlPrograms": [],
    }
