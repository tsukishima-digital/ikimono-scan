import json

import pytest
from ikimono_scan_ml.priority_registry import (
    load_priority_registry,
    validate_priority_registry,
)


def test_tracked_priority_registry_is_valid() -> None:
    registry = load_priority_registry("ml/taxonomy/priority-registry.json")

    aromia = next(item for item in registry["taxa"] if item["taxonId"] == 494519)
    assert aromia["scientificName"] == "Aromia bungii"
    assert aromia["priority"]["level"] == "P0"
    assert aromia["officialStatuses"] == [
        {
            "type": "specified_invasive_alien_species",
            "sourceId": "moe-specified-invasive-alien-species",
            "verifiedOn": "2026-08-14",
        }
    ]


def test_registry_rejects_training_weights() -> None:
    registry = _minimal_registry()
    registry["taxa"][0]["priority"]["oversamplingMultiplier"] = 5

    with pytest.raises(ValueError, match="training policy"):
        validate_priority_registry(registry)


def test_registry_rejects_unknown_source_and_identification_group() -> None:
    registry = _minimal_registry()
    registry["taxa"][0]["officialStatuses"][0]["sourceId"] = "missing-source"
    registry["taxa"][0]["identificationGroupIds"] = ["missing-group"]

    with pytest.raises(ValueError, match="unknown sourceId"):
        validate_priority_registry(registry)


def test_registry_requires_source_fingerprints() -> None:
    registry = _minimal_registry()
    registry["sources"][0]["monitor"]["sha256"] = "not-a-hash"

    with pytest.raises(ValueError, match="sha256"):
        validate_priority_registry(registry)


def test_registry_round_trips_as_json(tmp_path) -> None:
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(_minimal_registry()), encoding="utf-8")

    assert load_priority_registry(path) == _minimal_registry()


def _minimal_registry() -> dict:
    return {
        "schemaVersion": 1,
        "jurisdiction": "JP",
        "sources": [
            {
                "id": "official-source",
                "name": "Official source",
                "url": "https://example.go.jp/list",
                "monitor": {
                    "mode": "normalized_text_sha256",
                    "sha256": "a" * 64,
                },
            }
        ],
        "taxa": [
            {
                "taxonId": 494519,
                "scientificName": "Aromia bungii",
                "commonName": "クビアカツヤカミキリ",
                "officialStatuses": [
                    {
                        "type": "specified_invasive_alien_species",
                        "sourceId": "official-source",
                        "verifiedOn": "2026-08-14",
                    }
                ],
                "priority": {
                    "level": "P0",
                    "reasons": ["action_consequence"],
                    "falsePositiveImpact": "high",
                    "falseNegativeImpact": "high",
                },
                "identificationGroupIds": ["aromia-confusers"],
            }
        ],
        "identificationGroups": [
            {
                "id": "aromia-confusers",
                "anchorTaxonIds": [494519],
                "selectionRules": [{"type": "same_family_observed_in_japan"}],
            }
        ],
    }
