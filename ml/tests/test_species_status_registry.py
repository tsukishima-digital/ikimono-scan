import json

import pytest
from ikimono_scan_ml.species_status_registry import (
    load_species_status_registry,
    validate_species_status_registry,
)


def test_tracked_registry_contains_only_factual_species_labels() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")

    aromia = next(item for item in registry["taxa"] if item["taxonId"] == 494519)
    assert aromia["scientificName"] == "Aromia bungii"
    assert aromia["officialStatuses"] == [
        {
            "type": "specified_invasive_alien_species",
            "sourceId": "moe-specified-invasive-alien-species",
            "designationId": aromia["officialStatuses"][0]["designationId"],
            "verifiedOn": "2026-08-14",
        }
    ]
    assert "priority" not in aromia
    assert "designationPriorityDefaults" not in registry
    assert "identificationGroups" not in registry

    assert len(registry["officialDesignations"]) == 162
    assert {item["organismGroup"] for item in registry["officialDesignations"]} == {
        "amphibians",
        "arachnids",
        "birds",
        "crustaceans",
        "fish",
        "insects",
        "mammals",
        "mollusks",
        "plants",
        "reptiles",
    }


def test_tracked_registry_preserves_action_and_audience_combinations() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")
    program = next(
        item
        for item in registry["controlPrograms"]
        if item["id"] == "ibaraki-alien-longhorn-beetle-campaign-2026"
    )

    assert program["validFrom"] == "2026-06-01"
    assert program["validThrough"] == "2026-09-30"
    assert program["area"]["prefectureCode"] == "JP-08"
    assert program["participationPolicies"] == [
        {
            "targets": [
                {"taxonId": 494519, "lifeStages": ["adult"]},
                {"taxonId": 128525, "lifeStages": ["adult"]},
            ],
            "audience": {
                "type": "prefecture_residents",
                "jurisdictionCode": "JP-08",
                "minimumSchoolStage": "elementary_school",
            },
            "requestedActions": ["report"],
            "incentive": None,
        },
        {
            "targets": [
                {"taxonId": 494519, "lifeStages": ["adult"]},
                {"taxonId": 128525, "lifeStages": ["adult"]},
            ],
            "audience": {
                "type": "prefecture_residents",
                "jurisdictionCode": "JP-08",
                "minimumSchoolStage": "elementary_school",
                "excludedRoles": [
                    "commercial_pest_control",
                    "national_or_local_government_employee",
                    "independent_administrative_agency_employee",
                ],
                "guardianRequiredFor": [
                    "elementary_school_students",
                    "junior_high_school_students",
                ],
            },
            "requestedActions": ["capture", "kill", "submit_specimen"],
            "incentive": {
                "type": "prepaid_card",
                "valueYen": 500,
                "perSpecimenCount": 10,
            },
        },
    ]


def test_tracked_registry_covers_conditionally_specified_species() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")

    red_eared_slider = next(item for item in registry["taxa"] if item["taxonId"] == 39782)
    mississippi_slider = next(item for item in registry["taxa"] if item["taxonId"] == 51271)
    red_swamp_crayfish = next(item for item in registry["taxa"] if item["taxonId"] == 51221)

    for taxon in (red_eared_slider, mississippi_slider, red_swamp_crayfish):
        assert taxon["officialStatuses"][0]["type"] == (
            "conditionally_specified_invasive_alien_species"
        )
        assert "priority" not in taxon

    designations = registry["officialDesignations"]
    turtle = next(
        item for item in designations if "アカミミガメ（T. scripta）" in item["scopeText"]
    )
    crayfish = next(
        item for item in designations if item["scopeText"] == "アメリカザリガニ科の全種"
    )
    assert turtle["regulationType"] == "conditional"
    assert crayfish["conditionalMembers"] == ["アメリカザリガニ（Procambarus clarkii）"]


@pytest.mark.parametrize(
    "forbidden_key",
    [
        "priority",
        "designationPriorityDefaults",
        "falsePositiveImpact",
        "oversamplingMultiplier",
    ],
)
def test_registry_rejects_judgment_and_training_policy(forbidden_key: str) -> None:
    registry = _minimal_registry()
    registry["taxa"][0][forbidden_key] = "forbidden"

    with pytest.raises(ValueError, match="policy or judgment"):
        validate_species_status_registry(registry)


def test_registry_rejects_program_with_unknown_taxon() -> None:
    registry = _minimal_registry()
    registry["controlPrograms"][0]["participationPolicies"][0]["targets"][0]["taxonId"] = 999999

    with pytest.raises(ValueError, match="unknown taxonId"):
        validate_species_status_registry(registry)


def test_registry_rejects_program_without_atomic_audience_action_policy() -> None:
    registry = _minimal_registry()
    registry["controlPrograms"][0]["participationPolicies"] = []

    with pytest.raises(ValueError, match="participationPolicies"):
        validate_species_status_registry(registry)


def test_registry_requires_source_fingerprints() -> None:
    registry = _minimal_registry()
    registry["sources"][0]["monitor"]["sha256"] = "not-a-hash"

    with pytest.raises(ValueError, match="sha256"):
        validate_species_status_registry(registry)


def test_registry_round_trips_as_json(tmp_path) -> None:
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(_minimal_registry()), encoding="utf-8")

    assert load_species_status_registry(path) == _minimal_registry()


def _minimal_registry() -> dict:
    return {
        "schemaVersion": 1,
        "registryType": "species_status_and_control_programs",
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
        "officialDesignations": [
            {
                "id": "official-designation",
                "sourceId": "official-source",
                "organismGroup": "insects",
                "scopeText": "Aromia bungii",
                "regulationType": "specified",
                "conditionalMembers": [],
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
                        "designationId": "official-designation",
                        "verifiedOn": "2026-08-14",
                    }
                ],
            }
        ],
        "controlPrograms": [
            {
                "id": "control-program",
                "name": "Control program",
                "sourceId": "official-source",
                "area": {
                    "countryCode": "JP",
                    "prefectureCode": "JP-08",
                    "focusMunicipalities": ["つくば市"],
                },
                "validFrom": "2026-06-01",
                "validThrough": "2026-09-30",
                "participationPolicies": [
                    {
                        "targets": [{"taxonId": 494519, "lifeStages": ["adult"]}],
                        "audience": {
                            "type": "prefecture_residents",
                            "jurisdictionCode": "JP-08",
                        },
                        "requestedActions": ["capture", "kill"],
                        "incentive": None,
                    }
                ],
                "verifiedOn": "2026-08-14",
            }
        ],
    }
