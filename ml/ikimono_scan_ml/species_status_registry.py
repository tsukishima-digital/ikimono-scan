"""Load and validate factual species statuses and control-program records."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

REGULATION_TYPES = {"conditional", "specified"}
POLICY_OR_JUDGMENT_KEYS = {
    "classWeight",
    "designationPriorityDefaults",
    "falseNegativeImpact",
    "falsePositiveImpact",
    "identificationGroups",
    "lossWeight",
    "oversamplingMultiplier",
    "priority",
    "priorityLevel",
    "sampleWeight",
    "samplingProbability",
}
CONTROL_ACTIONS = {"capture", "kill", "remove", "report", "submit_specimen"}
AUDIENCE_TYPES = {
    "general_public",
    "municipality_residents",
    "permitted_trappers",
    "prefecture_residents",
    "property_owners_or_managers",
    "registered_control_workers",
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def load_species_status_registry(path: str | Path) -> dict:
    """Return a validated registry loaded from a UTF-8 JSON file."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_species_status_registry(payload)
    return payload


def validate_species_status_registry(registry: dict) -> None:
    """Validate factual records and reject embedded priority or training judgments."""

    if not isinstance(registry, dict) or registry.get("schemaVersion") != 1:
        raise ValueError("Species status registry must use schemaVersion 1")
    if registry.get("registryType") != "species_status_and_control_programs":
        raise ValueError("Species status registry has an invalid registryType")
    if registry.get("jurisdiction") != "JP":
        raise ValueError("Species status registry jurisdiction must be JP")

    sources = _required_list(registry, "sources")
    designations = _required_list(registry, "officialDesignations")
    taxa = _required_list(registry, "taxa")
    programs = _required_list(registry, "controlPrograms")
    _reject_policy_or_judgment(registry)

    source_ids: set[str] = set()
    for source in sources:
        source_id = _nonempty_string(source, "id", "source")
        if source_id in source_ids:
            raise ValueError(f"Duplicate source id: {source_id}")
        source_ids.add(source_id)
        _nonempty_string(source, "name", f"source {source_id}")
        url = _nonempty_string(source, "url", f"source {source_id}")
        if not url.startswith("https://"):
            raise ValueError(f"Source {source_id} must use HTTPS")
        monitor = source.get("monitor")
        if not isinstance(monitor, dict) or monitor.get("mode") != "normalized_text_sha256":
            raise ValueError(f"Source {source_id} must use normalized_text_sha256")
        digest = monitor.get("sha256")
        if not isinstance(digest, str) or SHA256_PATTERN.fullmatch(digest) is None:
            raise ValueError(f"Source {source_id} has an invalid sha256")

    designation_ids: set[str] = set()
    for designation in designations:
        designation_id = _nonempty_string(designation, "id", "official designation")
        if designation_id in designation_ids:
            raise ValueError(f"Duplicate official designation id: {designation_id}")
        designation_ids.add(designation_id)
        source_id = _nonempty_string(
            designation,
            "sourceId",
            f"official designation {designation_id}",
        )
        if source_id not in source_ids:
            raise ValueError(
                f"Official designation {designation_id} references unknown sourceId: {source_id}"
            )
        _nonempty_string(designation, "organismGroup", f"official designation {designation_id}")
        _nonempty_string(designation, "scopeText", f"official designation {designation_id}")
        if designation.get("regulationType") not in REGULATION_TYPES:
            raise ValueError(f"Official designation {designation_id} has an invalid regulationType")
        conditional_members = designation.get("conditionalMembers")
        if not isinstance(conditional_members, list) or any(
            not isinstance(member, str) or not member.strip() for member in conditional_members
        ):
            raise ValueError(
                f"Official designation {designation_id} conditionalMembers must be strings"
            )

    taxon_ids: set[int] = set()
    for taxon in taxa:
        taxon_id = taxon.get("taxonId")
        if not isinstance(taxon_id, int) or taxon_id <= 0:
            raise ValueError("Each taxon requires a positive integer taxonId")
        if taxon_id in taxon_ids:
            raise ValueError(f"Duplicate taxon id: {taxon_id}")
        taxon_ids.add(taxon_id)
        _nonempty_string(taxon, "scientificName", f"taxon {taxon_id}")
        _nonempty_string(taxon, "commonName", f"taxon {taxon_id}")

        statuses = taxon.get("officialStatuses")
        if not isinstance(statuses, list):
            raise ValueError(f"Taxon {taxon_id} officialStatuses must be a list")
        for status in statuses:
            source_id = _nonempty_string(status, "sourceId", f"taxon {taxon_id} status")
            if source_id not in source_ids:
                raise ValueError(f"Taxon {taxon_id} references unknown sourceId: {source_id}")
            designation_id = _nonempty_string(
                status,
                "designationId",
                f"taxon {taxon_id} status",
            )
            if designation_id not in designation_ids:
                raise ValueError(
                    f"Taxon {taxon_id} references unknown designationId: {designation_id}"
                )
            _nonempty_string(status, "type", f"taxon {taxon_id} status")
            _nonempty_string(status, "verifiedOn", f"taxon {taxon_id} status")

    program_ids: set[str] = set()
    for program in programs:
        program_id = _nonempty_string(program, "id", "control program")
        if program_id in program_ids:
            raise ValueError(f"Duplicate control program id: {program_id}")
        program_ids.add(program_id)
        _nonempty_string(program, "name", f"control program {program_id}")
        source_id = _nonempty_string(program, "sourceId", f"control program {program_id}")
        if source_id not in source_ids:
            raise ValueError(
                f"Control program {program_id} references unknown sourceId: {source_id}"
            )
        _validate_area(program.get("area"), program_id)
        _validate_date(program, "validFrom", program_id)
        _validate_date(program, "validThrough", program_id)
        if program["validFrom"] > program["validThrough"]:
            raise ValueError(f"Control program {program_id} has an invalid validity period")
        _validate_date(program, "verifiedOn", program_id)

        policies = program.get("participationPolicies")
        if not isinstance(policies, list) or not policies:
            raise ValueError(f"Control program {program_id} requires participationPolicies")
        for policy in policies:
            _validate_participation_policy(policy, program_id, taxon_ids)


def _required_list(payload: dict, key: str) -> list:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"Species status registry {key} must be a list")
    return value


def _nonempty_string(payload: dict, key: str, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} requires {key}")
    return value


def _validate_area(value, program_id: str) -> None:
    if not isinstance(value, dict) or value.get("countryCode") != "JP":
        raise ValueError(f"Control program {program_id} requires a Japanese area")
    _nonempty_string(value, "prefectureCode", f"control program {program_id} area")
    municipalities = value.get("focusMunicipalities")
    if not _nonempty_string_list(municipalities):
        raise ValueError(f"Control program {program_id} area requires focusMunicipalities")


def _validate_date(payload: dict, key: str, program_id: str) -> None:
    value = _nonempty_string(payload, key, f"control program {program_id}")
    try:
        date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"Control program {program_id} has an invalid {key}") from error


def _validate_participation_policy(policy, program_id: str, taxon_ids: set[int]) -> None:
    if not isinstance(policy, dict):
        raise ValueError(f"Control program {program_id} has an invalid participation policy")
    targets = policy.get("targets")
    if not isinstance(targets, list) or not targets:
        raise ValueError(f"Control program {program_id} participation policy requires targets")
    for target in targets:
        taxon_id = target.get("taxonId")
        if taxon_id not in taxon_ids:
            raise ValueError(f"Control program {program_id} references unknown taxonId: {taxon_id}")
        if not _nonempty_string_list(target.get("lifeStages")):
            raise ValueError(f"Control program {program_id} target requires lifeStages")
    audience = policy.get("audience")
    if not isinstance(audience, dict) or audience.get("type") not in AUDIENCE_TYPES:
        raise ValueError(f"Control program {program_id} has an invalid audience")
    _nonempty_string(audience, "jurisdictionCode", f"control program {program_id} audience")
    actions = policy.get("requestedActions")
    if (
        not isinstance(actions, list)
        or not actions
        or any(action not in CONTROL_ACTIONS for action in actions)
    ):
        raise ValueError(f"Control program {program_id} has invalid requestedActions")
    incentive = policy.get("incentive")
    if incentive is None:
        return
    if not isinstance(incentive, dict):
        raise ValueError(f"Control program {program_id} has an invalid incentive")
    _nonempty_string(incentive, "type", f"control program {program_id} incentive")
    if not isinstance(incentive.get("valueYen"), int) or incentive["valueYen"] <= 0:
        raise ValueError(f"Control program {program_id} incentive requires positive valueYen")
    if not isinstance(incentive.get("perSpecimenCount"), int) or incentive["perSpecimenCount"] <= 0:
        raise ValueError(
            f"Control program {program_id} incentive requires positive perSpecimenCount"
        )


def _nonempty_string_list(value) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and all(isinstance(item, str) and bool(item.strip()) for item in value)
    )


def _reject_policy_or_judgment(value) -> None:
    if isinstance(value, dict):
        forbidden = POLICY_OR_JUDGMENT_KEYS.intersection(value)
        if forbidden:
            names = ", ".join(sorted(forbidden))
            raise ValueError(
                f"Species status registry must not contain policy or judgment: {names}"
            )
        for child in value.values():
            _reject_policy_or_judgment(child)
    elif isinstance(value, list):
        for child in value:
            _reject_policy_or_judgment(child)
