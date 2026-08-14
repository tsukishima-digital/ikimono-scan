from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ikimono_scan_ml.checkpoint import load_checkpoint

INAT_TAXA_URL = "https://api.inaturalist.org/v1/taxa"
USER_AGENT = "ikimono-scan/0.1 (https://github.com/tsukishima-digital/ikimono-scan)"
BATCH_SIZE = 30


def refresh_japanese_catalog(*, checkpoint_path: str | Path, output_path: str | Path) -> Path:
    checkpoint = load_checkpoint(checkpoint_path, map_location="cpu")
    taxon_ids = [_taxon_id(label) for label in checkpoint["classes"]]
    taxa: dict[str, dict[str, str]] = {}

    for offset in range(0, len(taxon_ids), BATCH_SIZE):
        batch = taxon_ids[offset : offset + BATCH_SIZE]
        query = urlencode({"locale": "ja", "preferred_place_id": 36})
        request = Request(
            f"{INAT_TAXA_URL}/{','.join(batch)}?{query}",
            headers={"User-Agent": USER_AGENT},
        )
        with urlopen(request, timeout=30) as response:
            payload: dict[str, Any] = json.load(response)
        for result in payload.get("results", []):
            taxon_id = str(result["id"])
            entry = {"scientificName": str(result["name"])}
            if result.get("preferred_common_name"):
                entry["commonName"] = str(result["preferred_common_name"])
            taxa[taxon_id] = entry

    missing = sorted(set(taxon_ids) - taxa.keys())
    if missing:
        raise RuntimeError(f"iNaturalist did not return taxon IDs: {', '.join(missing)}")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "source": INAT_TAXA_URL,
                "locale": "ja",
                "preferredPlaceId": 36,
                "taxa": dict(sorted(taxa.items(), key=lambda item: int(item[0]))),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return output_path


def _taxon_id(label: str) -> str:
    taxon_id, separator, _ = label.partition("_")
    if not separator or not taxon_id.isdigit():
        raise ValueError(f"Unsupported class label: {label}")
    return taxon_id
