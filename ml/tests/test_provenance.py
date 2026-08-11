import hashlib
import json
from pathlib import Path

import pytest
from ikimono_scan_ml.provenance import audit_split_manifest, write_audit


def _legacy_name(observation_id: int, photo_url: str) -> str:
    medium_url = photo_url.replace("square.", "medium.")
    digest = hashlib.sha256(f"{observation_id}:{medium_url}".encode()).hexdigest()[:16]
    return f"{observation_id}_{digest}.jpg"


class FakeClient:
    def __init__(self, observations: list[dict]) -> None:
        self.observations_by_id = {item["id"]: item for item in observations}
        self.requests: list[list[int]] = []

    def observations_by_ids(self, observation_ids: list[int]) -> list[dict]:
        self.requests.append(observation_ids)
        return [
            self.observations_by_id[observation_id]
            for observation_id in observation_ids
            if observation_id in self.observations_by_id
        ]


def test_audit_records_the_exact_trained_photo_and_required_provenance(tmp_path: Path) -> None:
    selected_url = "https://inaturalist-open-data.s3.amazonaws.com/photos/202/medium.jpg"
    manifest = tmp_path / "split_manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "train",
                "class_name": "494519_aromia_bungii",
                "path": f"/workspace/data/{_legacy_name(100, selected_url)}",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    client = FakeClient(
        [
            {
                "id": 100,
                "user": {"login": "observer", "name": "Observer Name"},
                "photos": [
                    {
                        "id": 201,
                        "url": "https://inaturalist-open-data.s3.amazonaws.com/photos/201/square.jpg",
                        "license_code": "cc0",
                    },
                    {
                        "id": 202,
                        "url": selected_url,
                        "license_code": "cc-by-nc",
                        "attribution": "(c) Observer Name, some rights reserved",
                    },
                ],
            }
        ]
    )

    records, summary = audit_split_manifest(manifest, client=client, batch_size=50)

    assert records == [
        {
            "split": "train",
            "class_name": "494519_aromia_bungii",
            "file_name": _legacy_name(100, selected_url),
            "observation_id": 100,
            "photo_id": 202,
            "creator": "Observer Name",
            "creator_login": "observer",
            "source_url": "https://www.inaturalist.org/photos/202",
            "observation_url": "https://www.inaturalist.org/observations/100",
            "asset_url": selected_url,
            "license_code": "cc-by-nc",
            "attribution": "(c) Observer Name, some rights reserved",
            "status": "matched",
        }
    ]
    assert summary == {
        "image_count": 1,
        "matched_count": 1,
        "unresolved_count": 0,
        "license_counts": {"cc-by-nc": 1},
    }
    assert client.requests == [[100]]


def test_audit_marks_missing_observations_without_guessing_photo_metadata(tmp_path: Path) -> None:
    manifest = tmp_path / "split_manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "val",
                "class_name": "494519_aromia_bungii",
                "path": "/workspace/data/999_deadbeefdeadbeef.jpg",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    records, summary = audit_split_manifest(manifest, client=FakeClient([]))

    assert records[0]["observation_id"] == 999
    assert records[0]["photo_id"] is None
    assert records[0]["status"] == "observation_not_found"
    assert summary["unresolved_count"] == 1
    assert summary["license_counts"] == {"unresolved": 1}


def test_audit_counts_a_matched_photo_without_a_license_as_unlicensed(tmp_path: Path) -> None:
    photo_url = "https://example.org/photos/202/medium.jpg"
    manifest = tmp_path / "split_manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "train",
                "class_name": "494519_aromia_bungii",
                "path": f"/workspace/data/{_legacy_name(100, photo_url)}",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    client = FakeClient(
        [
            {
                "id": 100,
                "user": {"login": "observer"},
                "photos": [{"id": 202, "url": photo_url, "license_code": None}],
            }
        ]
    )

    records, summary = audit_split_manifest(manifest, client=client)

    assert records[0]["status"] == "matched"
    assert records[0]["license_code"] is None
    assert summary["license_counts"] == {"unlicensed": 1}


def test_audit_rejects_a_photo_when_the_legacy_url_hash_does_not_match(tmp_path: Path) -> None:
    manifest = tmp_path / "split_manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "train",
                "class_name": "494519_aromia_bungii",
                "path": "/workspace/data/100_deadbeefdeadbeef.jpg",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    client = FakeClient(
        [
            {
                "id": 100,
                "user": {"login": "observer"},
                "photos": [
                    {
                        "id": 202,
                        "url": "https://example.org/photos/202/square.jpg",
                        "license_code": "cc-by",
                    }
                ],
            }
        ]
    )

    records, summary = audit_split_manifest(manifest, client=client)

    assert records[0]["status"] == "photo_not_found"
    assert records[0]["photo_id"] is None
    assert summary["unresolved_count"] == 1


def test_audit_matches_a_photo_after_the_inaturalist_asset_host_migrates(tmp_path: Path) -> None:
    current_url = "https://inaturalist-open-data.s3.amazonaws.com/photos/202/medium.jpg"
    legacy_url = "https://static.inaturalist.org/photos/202/medium.jpg"
    manifest = tmp_path / "split_manifest.jsonl"
    manifest.write_text(
        json.dumps(
            {
                "split": "train",
                "class_name": "494519_aromia_bungii",
                "path": f"/workspace/data/{_legacy_name(100, legacy_url)}",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    client = FakeClient(
        [
            {
                "id": 100,
                "user": {"login": "observer"},
                "photos": [{"id": 202, "url": current_url, "license_code": "cc-by"}],
            }
        ]
    )

    records, summary = audit_split_manifest(manifest, client=client)

    assert records[0]["status"] == "matched"
    assert records[0]["photo_id"] == 202
    assert records[0]["asset_url"] == current_url
    assert summary["unresolved_count"] == 0


def test_audit_rejects_duplicate_observation_ids(tmp_path: Path) -> None:
    manifest = tmp_path / "split_manifest.jsonl"
    row = {
        "split": "train",
        "class_name": "494519_aromia_bungii",
        "path": "/workspace/data/100_deadbeefdeadbeef.jpg",
    }
    manifest.write_text(json.dumps(row) + "\n" + json.dumps(row) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate observation ID: 100"):
        audit_split_manifest(manifest, client=FakeClient([]))


def test_write_audit_records_the_provenance_checksum(tmp_path: Path) -> None:
    output_path = tmp_path / "provenance.jsonl"
    summary_path = tmp_path / "summary.json"
    records = [{"observation_id": 100, "status": "matched"}]

    write_audit(
        records,
        {"image_count": 1},
        output_path=output_path,
        summary_path=summary_path,
    )

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary["provenance_sha256"] == hashlib.sha256(output_path.read_bytes()).hexdigest()
