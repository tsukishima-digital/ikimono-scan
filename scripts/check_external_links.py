from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = "ikimono-scan-link-check/1.0"


def load_external_links(path: str | Path) -> dict[str, str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not payload:
        raise ValueError("External link catalog must contain named HTTPS URLs")
    if any(
        not isinstance(name, str) or not isinstance(url, str) or not url.startswith("https://")
        for name, url in payload.items()
    ):
        raise ValueError("External link catalog must contain named HTTPS URLs")
    return payload


def check_url(url: str) -> int:
    for attempt in range(3):
        try:
            return _check_url_once(url)
        except HTTPError:
            raise
        except URLError:
            if attempt == 2:
                raise
            # Implementation: Retry transient DNS and connection failures before alerting.
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def _check_url_once(url: str) -> int:
    request = Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=20) as response:
            return response.status
    except HTTPError as error:
        if error.code not in {403, 405}:
            raise
    # Implementation: Some public sites block HEAD while serving the same URL via GET.
    request = Request(url, method="GET", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return response.status


def main() -> None:
    parser = argparse.ArgumentParser(description="Check product-facing external links")
    parser.add_argument("catalog")
    args = parser.parse_args()

    for name, url in load_external_links(args.catalog).items():
        status = check_url(url)
        if not 200 <= status < 400:
            raise RuntimeError(f"{name}: unexpected HTTP status {status}")
        print(f"{name}: {status} {url}")


if __name__ == "__main__":
    main()
