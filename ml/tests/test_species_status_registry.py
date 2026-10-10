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
                {
                    "taxonId": 494519,
                    "subjects": [{"type": "organism", "lifeStage": "adult"}],
                },
                {
                    "taxonId": 128525,
                    "subjects": [{"type": "organism", "lifeStage": "adult"}],
                },
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
                {
                    "taxonId": 494519,
                    "subjects": [{"type": "organism", "lifeStage": "adult"}],
                },
                {
                    "taxonId": 128525,
                    "subjects": [{"type": "organism", "lifeStage": "adult"}],
                },
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
                "description": "成虫10匹につき500円分",
                "amount": {"currency": "JPY", "value": 500},
                "rate": {"count": 10, "unit": "dead_adult_specimens"},
                "availability": "while_budget_or_supplies_last",
            },
        },
    ]


def test_tracked_registry_covers_verified_local_control_programs() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")

    assert {program["id"] for program in registry["controlPrograms"]} == {
        "fukagawa-raccoon-bounty",
        "gunma-kubiaka-card-2026",
        "gunma-kubiaka-reporting-2026",
        "higashimatsuyama-kubiaka-bounty-2026",
        "ibaraki-alien-longhorn-beetle-campaign-2026",
        "ibaraki-kyon-bounties",
        "iwakuni-nutria-raccoon-bounty",
        "kato-small-mammal-bounty-2024-2027",
        "kawachinagano-kubiaka-ranking-2026",
        "osaka-kubiaka-summer-campaign-2026",
        "sakai-raccoon-bounty",
        "shosanbetsu-raccoon-bounty",
        "tomioka-medium-mammal-bounty",
        "tokyo-oshima-kyon-bounty",
    }


def test_kyon_programs_keep_public_reporting_and_qualified_capture_separate() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")
    ibaraki = _program(registry, "ibaraki-kyon-bounties")
    tokyo = _program(registry, "tokyo-oshima-kyon-bounty")

    report_policy, capture_policy = ibaraki["participationPolicies"]
    assert report_policy["audience"]["type"] == "general_public"
    assert report_policy["requestedActions"] == ["photograph", "report"]
    assert report_policy["incentive"]["amount"]["value"] == 2000
    assert capture_policy["audience"]["type"] == "licensed_hunters"
    assert capture_policy["requestedActions"] == ["capture", "kill", "report"]
    assert capture_policy["incentive"]["amount"]["value"] == 30000

    tokyo_policy = tokyo["participationPolicies"][0]
    assert tokyo_policy["audience"]["type"] == "municipality_residents"
    assert tokyo_policy["requestedActions"] == ["inspect_trap", "report_capture"]
    assert "kill" not in tokyo_policy["requestedActions"]
    assert tokyo_policy["incentive"]["amount"]["value"] == 8000


def test_beetle_programs_preserve_non_cash_and_trace_incentives() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")
    gunma = _program(registry, "gunma-kubiaka-card-2026")
    osaka = _program(registry, "osaka-kubiaka-summer-campaign-2026")
    kawachinagano = _program(registry, "kawachinagano-kubiaka-ranking-2026")

    assert gunma["participationPolicies"][0]["incentive"]["type"] == "collectible_card"
    assert osaka["participationPolicies"][0]["incentive"]["type"] == "ranked_prize"
    trace_policy = next(
        policy
        for policy in kawachinagano["participationPolicies"]
        if policy["targets"][0]["subjects"][0]["type"] == "trace"
    )
    assert trace_policy["targets"][0]["subjects"] == [{"type": "trace", "traceType": "frass"}]
    assert trace_policy["incentive"]["pointsPerUnit"] == 1


def test_small_mammal_bounty_keeps_taxa_actions_and_audience_together() -> None:
    registry = load_species_status_registry("ml/taxonomy/species-status-registry.json")
    kato = _program(registry, "kato-small-mammal-bounty-2024-2027")
    policy = kato["participationPolicies"][0]

    assert {target["taxonId"] for target in policy["targets"]} == {41663, 43997, 41625}
    assert policy["audience"]["type"] == "registered_trap_users"
    assert policy["requestedActions"] == ["capture", "report_capture", "hand_over_live_animal"]
    assert policy["incentive"]["amount"]["value"] == 3000


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


def test_registry_accepts_unknown_program_end_date() -> None:
    registry = _minimal_registry()
    registry["controlPrograms"][0]["validThrough"] = None

    validate_species_status_registry(registry)


def test_registry_requires_source_fingerprints() -> None:
    registry = _minimal_registry()
    registry["sources"][0]["monitor"]["sha256"] = "not-a-hash"

    with pytest.raises(ValueError, match="sha256"):
        validate_species_status_registry(registry)


def test_registry_accepts_explicit_manual_source_monitoring() -> None:
    registry = _minimal_registry()
    registry["sources"][0]["monitor"] = {
        "mode": "manual",
        "checkedOn": "2026-08-14",
        "reason": "tls_incompatible_with_automation",
    }

    validate_species_status_registry(registry)


def test_registry_round_trips_as_json(tmp_path) -> None:
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(_minimal_registry()), encoding="utf-8")

    assert load_species_status_registry(path) == _minimal_registry()


def _program(registry: dict, program_id: str) -> dict:
    return next(program for program in registry["controlPrograms"] if program["id"] == program_id)


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
                        "targets": [
                            {
                                "taxonId": 494519,
                                "subjects": [{"type": "organism", "lifeStage": "adult"}],
                            }
                        ],
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
