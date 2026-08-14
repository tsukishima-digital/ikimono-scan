"""Load and validate the policy registry for high-consequence species identification."""

from __future__ import annotations

import json
import re
from pathlib import Path

PRIORITY_LEVELS = {"P0", "P1", "P2"}
IMPACT_LEVELS = {"high", "medium", "low"}
TRAINING_POLICY_KEYS = {
    "classWeight",
    "lossWeight",
    "oversamplingMultiplier",
    "sampleWeight",
    "samplingProbability",
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def load_priority_registry(path: str | Path) -> dict:
    """Return a validated registry loaded from a UTF-8 JSON file."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_priority_registry(payload)
    return payload


def validate_priority_registry(registry: dict) -> None:
    """Validate registry references and reject embedded model-training policy."""

    if not isinstance(registry, dict) or registry.get("schemaVersion") != 1:
        raise ValueError("Priority registry must use schemaVersion 1")
    if registry.get("jurisdiction") != "JP":
        raise ValueError("Priority registry jurisdiction must be JP")

    sources = _required_list(registry, "sources")
    taxa = _required_list(registry, "taxa")
    groups = _required_list(registry, "identificationGroups")
    _reject_training_policy(registry)

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

    group_ids: set[str] = set()
    for group in groups:
        group_id = _nonempty_string(group, "id", "identification group")
        if group_id in group_ids:
            raise ValueError(f"Duplicate identification group id: {group_id}")
        group_ids.add(group_id)
        anchors = group.get("anchorTaxonIds")
        invalid_anchors = (
            not isinstance(anchors, list)
            or not anchors
            or any(not isinstance(x, int) for x in anchors)
        )
        if invalid_anchors:
            raise ValueError(f"Identification group {group_id} requires integer anchorTaxonIds")
        rules = group.get("selectionRules")
        if not isinstance(rules, list) or not rules:
            raise ValueError(f"Identification group {group_id} requires selectionRules")

    taxon_ids: set[int] = set()
    for taxon in taxa:
        taxon_id = taxon.get("taxonId")
        if not isinstance(taxon_id, int) or taxon_id <= 0:
            raise ValueError("Each priority taxon requires a positive integer taxonId")
        if taxon_id in taxon_ids:
            raise ValueError(f"Duplicate priority taxon id: {taxon_id}")
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
            _nonempty_string(status, "type", f"taxon {taxon_id} status")
            _nonempty_string(status, "verifiedOn", f"taxon {taxon_id} status")

        priority = taxon.get("priority")
        if not isinstance(priority, dict) or priority.get("level") not in PRIORITY_LEVELS:
            raise ValueError(f"Taxon {taxon_id} requires a P0, P1, or P2 priority")
        if priority.get("falsePositiveImpact") not in IMPACT_LEVELS:
            raise ValueError(f"Taxon {taxon_id} has an invalid falsePositiveImpact")
        if priority.get("falseNegativeImpact") not in IMPACT_LEVELS:
            raise ValueError(f"Taxon {taxon_id} has an invalid falseNegativeImpact")
        reasons = priority.get("reasons")
        if not isinstance(reasons, list) or not reasons:
            raise ValueError(f"Taxon {taxon_id} priority requires reasons")

        referenced_groups = taxon.get("identificationGroupIds")
        if not isinstance(referenced_groups, list):
            raise ValueError(f"Taxon {taxon_id} identificationGroupIds must be a list")
        for group_id in referenced_groups:
            if group_id not in group_ids:
                raise ValueError(
                    f"Taxon {taxon_id} references unknown identification group: {group_id}"
                )

    for group in groups:
        for anchor_id in group["anchorTaxonIds"]:
            if anchor_id not in taxon_ids:
                raise ValueError(
                    "Identification group "
                    f"{group['id']} references unknown anchor taxon: {anchor_id}"
                )


def _required_list(payload: dict, key: str) -> list:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"Priority registry {key} must be a list")
    return value


def _nonempty_string(payload: dict, key: str, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} requires {key}")
    return value


def _reject_training_policy(value) -> None:
    if isinstance(value, dict):
        forbidden = TRAINING_POLICY_KEYS.intersection(value)
        if forbidden:
            names = ", ".join(sorted(forbidden))
            raise ValueError(f"Priority registry must not contain training policy: {names}")
        for child in value.values():
            _reject_training_policy(child)
    elif isinstance(value, list):
        for child in value:
            _reject_training_policy(child)
