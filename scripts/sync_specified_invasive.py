"""Synchronize official specified-invasive scopes in the species-status registry."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

from ikimono_scan_ml.species_status_registry import validate_species_status_registry
from ikimono_scan_ml.specified_invasive import SOURCE_ID, extract_designations

USER_AGENT = "ikimono-scan-specified-invasive-sync/1.0"


def current_designations(registry: dict) -> list[dict]:
    """Fetch and extract all designation scopes from the registry's official MOE source."""

    source = next(item for item in registry["sources"] if item["id"] == SOURCE_ID)
    request = Request(source["url"], headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return extract_designations(response.read())


def refresh(path: str | Path) -> None:
    """Replace designation scopes while preserving reviewed taxon mappings and priorities."""

    registry_path = Path(path)
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    registry["officialDesignations"] = current_designations(registry)
    validate_species_status_registry(registry)
    registry_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Synchronize specified-invasive designations")
    parser.add_argument("registry", type=Path)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    extracted = current_designations(registry)
    if args.refresh:
        registry["officialDesignations"] = extracted
        validate_species_status_registry(registry)
        args.registry.write_text(
            json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return 0
    if registry.get("officialDesignations") != extracted:
        print("Tracked specified-invasive designations differ from the official source")
        return 2
    print(f"Specified-invasive designations are current: {len(extracted)} scopes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
