import json

from scripts import check_priority_sources


def test_normalized_html_fingerprint_ignores_markup_and_whitespace() -> None:
    first = b"<html><body><h1>Official list</h1><p>Aromia bungii</p></body></html>"
    second = b"<html>\n<body><h1> Official list </h1> <p>Aromia bungii</p></body>\n</html>"

    assert check_priority_sources.fingerprint(first) == check_priority_sources.fingerprint(second)


def test_check_sources_reports_only_changed_content(monkeypatch) -> None:
    unchanged = b"<main>unchanged</main>"
    changed = b"<main>changed</main>"
    registry = _registry(
        {
            "stable": check_priority_sources.fingerprint(unchanged),
            "changed": "a" * 64,
        }
    )
    responses = {
        "https://example.go.jp/stable": unchanged,
        "https://example.go.jp/changed": changed,
    }
    monkeypatch.setattr(check_priority_sources, "fetch", responses.__getitem__)

    results = check_priority_sources.check_sources(registry)

    assert [item["sourceId"] for item in results] == ["changed"]
    assert results[0]["actualSha256"] == check_priority_sources.fingerprint(changed)


def test_refresh_updates_only_source_fingerprints(tmp_path, monkeypatch) -> None:
    content = b"<main>new official list</main>"
    path = tmp_path / "priority-registry.json"
    path.write_text(json.dumps(_registry({"source": "a" * 64})), encoding="utf-8")
    monkeypatch.setattr(check_priority_sources, "fetch", lambda _: content)

    check_priority_sources.refresh(path, checked_on="2026-08-14")

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["sources"][0]["monitor"] == {
        "mode": "normalized_text_sha256",
        "sha256": check_priority_sources.fingerprint(content),
        "checkedOn": "2026-08-14",
    }


def _registry(fingerprints: dict[str, str]) -> dict:
    return {
        "schemaVersion": 1,
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
        "taxa": [],
        "identificationGroups": [],
    }
