"""Reconstruct photo-level provenance for an immutable training split."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

from ikimono_scan_ml.inat import INaturalistClient

DEFAULT_API_BASE_URL = "https://api.inaturalist.org/v1"
LEGACY_FILE_PATTERN = re.compile(r"^(?P<observation_id>\d+)_(?P<digest>[0-9a-f]{16})\.[^.]+$")


class ObservationClient(Protocol):
    """Return current iNaturalist observations for the requested identifiers."""

    def observations_by_ids(self, observation_ids: list[int]) -> list[dict[str, Any]]: ...


def audit_split_manifest(
    manifest_path: str | Path,
    *,
    client: ObservationClient,
    batch_size: int = 100,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Resolve the exact photo used by every row in a legacy split manifest.

    The legacy filename contains an observation identifier and the first 16 hex
    characters of SHA-256 over ``observation_id:medium_photo_url``. The digest is
    matched against every current photo on the observation so later photo-order
    changes cannot silently assign provenance from a different image.
    """

    if batch_size < 1 or batch_size > 200:
        raise ValueError("batch_size must be between 1 and 200")
    split_rows = _load_split_rows(Path(manifest_path))
    observations: dict[int, dict[str, Any]] = {}
    observation_ids = [row["observation_id"] for row in split_rows]
    for start in range(0, len(observation_ids), batch_size):
        batch = observation_ids[start : start + batch_size]
        for observation in client.observations_by_ids(batch):
            observation_id = observation.get("id")
            if isinstance(observation_id, int):
                observations[observation_id] = observation

    records = [
        _provenance_record(row, observations.get(row["observation_id"])) for row in split_rows
    ]
    license_counts = Counter(
        (record["license_code"] or "unlicensed") if record["status"] == "matched" else "unresolved"
        for record in records
    )
    return records, {
        "image_count": len(records),
        "matched_count": sum(record["status"] == "matched" for record in records),
        "unresolved_count": sum(record["status"] != "matched" for record in records),
        "license_counts": dict(sorted(license_counts.items())),
    }


def _load_split_rows(manifest_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen_observations: set[int] = set()
    with manifest_path.open(encoding="utf-8") as manifest_file:
        for line_number, line in enumerate(manifest_file, start=1):
            if not line.strip():
                continue
            payload = json.loads(line)
            file_name = Path(str(payload["path"])).name
            match = LEGACY_FILE_PATTERN.fullmatch(file_name)
            if match is None:
                raise ValueError(f"Unsupported legacy filename on line {line_number}: {file_name}")
            observation_id = int(match.group("observation_id"))
            if observation_id in seen_observations:
                raise ValueError(f"Duplicate observation ID: {observation_id}")
            seen_observations.add(observation_id)
            rows.append(
                {
                    "split": str(payload["split"]),
                    "class_name": str(payload["class_name"]),
                    "file_name": file_name,
                    "observation_id": observation_id,
                    "digest": match.group("digest"),
                }
            )
    return rows


def _provenance_record(row: dict[str, Any], observation: dict[str, Any] | None) -> dict[str, Any]:
    base_record = {
        "split": row["split"],
        "class_name": row["class_name"],
        "file_name": row["file_name"],
        "observation_id": row["observation_id"],
    }
    if observation is None:
        return _unresolved_record(base_record, "observation_not_found")

    photo = next(
        (
            candidate
            for candidate in observation.get("photos") or []
            if row["digest"] in _photo_digests(row["observation_id"], candidate)
        ),
        None,
    )
    if photo is None:
        return _unresolved_record(base_record, "photo_not_found")

    photo_id = photo.get("id")
    user = observation.get("user") or {}
    creator_login = user.get("login")
    creator = user.get("name") or creator_login
    return {
        **base_record,
        "photo_id": photo_id,
        "creator": creator,
        "creator_login": creator_login,
        "source_url": f"https://www.inaturalist.org/photos/{photo_id}",
        "observation_url": f"https://www.inaturalist.org/observations/{row['observation_id']}",
        "asset_url": _medium_photo_url(photo),
        "license_code": photo.get("license_code"),
        "attribution": photo.get("attribution"),
        "status": "matched",
    }


def _unresolved_record(base_record: dict[str, Any], status: str) -> dict[str, Any]:
    return {
        **base_record,
        "photo_id": None,
        "creator": None,
        "creator_login": None,
        "source_url": None,
        "observation_url": f"https://www.inaturalist.org/observations/{base_record['observation_id']}",
        "asset_url": None,
        "license_code": None,
        "attribution": None,
        "status": status,
    }


def _medium_photo_url(photo: dict[str, Any]) -> str | None:
    url = photo.get("url")
    if not isinstance(url, str):
        return None
    return url.replace("square.", "medium.")


def _photo_digests(observation_id: int, photo: dict[str, Any]) -> set[str]:
    url = _medium_photo_url(photo)
    if url is None:
        return set()
    urls = {url}
    parsed = urlsplit(url)
    if parsed.netloc == "inaturalist-open-data.s3.amazonaws.com":
        # Implementation: Older API responses used this host for the same immutable photo ID.
        urls.add(urlunsplit(parsed._replace(netloc="static.inaturalist.org")))
    return {
        hashlib.sha256(f"{observation_id}:{candidate_url}".encode()).hexdigest()[:16]
        for candidate_url in urls
    }


def write_audit(
    records: list[dict[str, Any]],
    summary: dict[str, Any],
    *,
    output_path: Path,
    summary_path: Path,
) -> None:
    """Write the provenance records and a dated aggregate summary."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    serialized_records = "".join(
        json.dumps(record, ensure_ascii=False) + "\n" for record in records
    )
    output_path.write_text(serialized_records, encoding="utf-8")
    dated_summary = {
        "retrieved_at": datetime.now(UTC).isoformat(),
        "provenance_sha256": hashlib.sha256(serialized_records.encode()).hexdigest(),
        **summary,
    }
    summary_path.write_text(
        json.dumps(dated_summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit iNaturalist training-photo provenance.")
    parser.add_argument("--split-manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path)
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()
    records, summary = audit_split_manifest(
        args.split_manifest,
        client=INaturalistClient(args.api_base_url),
        batch_size=args.batch_size,
    )
    write_audit(records, summary, output_path=args.output, summary_path=args.summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if summary["unresolved_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
