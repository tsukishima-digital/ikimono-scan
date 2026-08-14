"""Detect content changes in official species-status and control-program sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from ikimono_scan_ml.species_status_registry import load_species_status_registry

USER_AGENT = "ikimono-scan-species-status-source-check/1.0"


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript"}:
            self.hidden_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self.hidden_depth:
            self.hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden_depth:
            self.parts.append(data)


def fingerprint(content: bytes) -> str:
    """Hash normalized visible HTML text so layout-only changes do not alert."""

    parser = _VisibleTextParser()
    parser.feed(content.decode("utf-8", errors="replace"))
    normalized = " ".join(re.findall(r"\S+", " ".join(parser.parts)))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def fetch(url: str) -> bytes:
    """Fetch one official HTTPS source, retrying transient connection failures."""

    request = Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except URLError:
            if attempt == 2:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def check_sources(registry: dict) -> list[dict[str, str]]:
    """Return source identifiers and digests whose normalized content changed."""

    changed: list[dict[str, str]] = []
    for source in registry["sources"]:
        if source["monitor"]["mode"] == "manual":
            continue
        actual = fingerprint(fetch(source["url"]))
        expected = source["monitor"]["sha256"]
        if actual != expected:
            changed.append(
                {
                    "sourceId": source["id"],
                    "name": source["name"],
                    "url": source["url"],
                    "expectedSha256": expected,
                    "actualSha256": actual,
                }
            )
    return changed


def refresh(path: str | Path, *, checked_on: str | None = None) -> None:
    """Replace stored fingerprints after a human has reviewed official changes."""

    registry_path = Path(path)
    registry = load_species_status_registry(registry_path)
    date = checked_on or datetime.now(UTC).date().isoformat()
    for source in registry["sources"]:
        if source["monitor"]["mode"] == "manual":
            continue
        source["monitor"]["sha256"] = fingerprint(fetch(source["url"]))
        source["monitor"]["checkedOn"] = date
    registry_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Check official species-status sources")
    parser.add_argument("registry", type=Path)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    if args.refresh:
        refresh(args.registry)
        return 0

    registry = load_species_status_registry(args.registry)
    changed = check_sources(registry)
    report = json.dumps({"changedSources": changed}, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(report, encoding="utf-8")
    print(report, end="")
    return 2 if changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
