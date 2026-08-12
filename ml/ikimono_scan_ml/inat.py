from __future__ import annotations

import argparse
import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from PIL import Image
from tqdm import tqdm

from ikimono_scan_ml.config import load_yaml, project_path


@dataclass(frozen=True)
class Taxon:
    id: int
    scientific_name: str
    preferred_common_name: str | None
    observations_count: int

    @property
    def class_dir_name(self) -> str:
        slug = self.scientific_name.lower().replace(" ", "_")
        return f"{self.id}_{slug}"


@dataclass(frozen=True)
class TaxonFetchPlanItem:
    taxon: Taxon
    group: str
    max_images: int


class INaturalistClient:
    def __init__(self, api_base_url: str, *, timeout_seconds: int = 30) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Ikimono Scan Phase0 ML PoC"})

    def get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        response = _get_with_retries(
            self.session,
            f"{self.api_base_url}/{path.lstrip('/')}",
            params=params,
            timeout_seconds=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Unexpected iNaturalist response for {path}")
        return payload

    def species_counts(
        self,
        params: dict[str, Any],
        *,
        per_page: int,
        max_taxa: int | None = None,
        request_sleep_seconds: float = 0.0,
    ) -> list[Taxon]:
        taxa: list[Taxon] = []
        page = 1
        page_size = min(per_page, 500)
        while max_taxa is None or len(taxa) < max_taxa:
            payload = self.get(
                "observations/species_counts",
                {**params, "page": page, "per_page": page_size},
            )
            results = payload.get("results", [])
            if not results:
                break
            for item in results:
                taxon = item.get("taxon") or {}
                taxon_id = taxon.get("id")
                name = taxon.get("name")
                if not isinstance(taxon_id, int) or not isinstance(name, str):
                    continue
                taxa.append(
                    Taxon(
                        id=taxon_id,
                        scientific_name=name,
                        preferred_common_name=taxon.get("preferred_common_name"),
                        observations_count=int(item.get("count") or 0),
                    )
                )
                if max_taxa is not None and len(taxa) >= max_taxa:
                    break
            if (max_taxa is not None and len(taxa) >= max_taxa) or len(results) < page_size:
                break
            page += 1
            time.sleep(request_sleep_seconds)
        return taxa

    def observations(
        self,
        params: dict[str, Any],
        *,
        per_page: int,
        max_results: int,
    ) -> list[dict[str, Any]]:
        observations: list[dict[str, Any]] = []
        page = 1
        while len(observations) < max_results:
            payload = self.get(
                "observations",
                {**params, "page": page, "per_page": min(per_page, 200)},
            )
            results = payload.get("results", [])
            if not results:
                break
            observations.extend(results[: max_results - len(observations)])
            page += 1
        return observations

    def observations_by_ids(self, observation_ids: list[int]) -> list[dict[str, Any]]:
        """Fetch up to 200 observations by their stable iNaturalist identifiers."""

        if not observation_ids:
            return []
        if len(observation_ids) > 200:
            raise ValueError("iNaturalist observation ID batches cannot exceed 200")
        payload = self.get(
            "observations",
            {"id": ",".join(str(value) for value in observation_ids), "per_page": 200},
        )
        results = payload.get("results", [])
        return [item for item in results if isinstance(item, dict)]

    def resolve_taxon(self, scientific_name: str) -> Taxon:
        payload = self.get(
            "taxa",
            {"q": scientific_name, "rank": "species,kingdom,class,family,order"},
        )
        for item in payload.get("results", []):
            if item.get("name") == scientific_name:
                return Taxon(
                    id=int(item["id"]),
                    scientific_name=str(item["name"]),
                    preferred_common_name=item.get("preferred_common_name"),
                    observations_count=int(item.get("observations_count") or 0),
                )
        raise ValueError(f"Could not resolve iNaturalist taxon: {scientific_name}")


def fetch_dataset(config_path: str | Path) -> None:
    config = load_yaml(config_path)
    source = config["source"]
    place = config["place"]
    filters = config["filters"]
    limits = config["limits"]
    paths = config["paths"]

    output_dir = project_path(paths["output_dir"])
    cache_dir = project_path(paths["cache_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    client = INaturalistClient(source["api_base_url"])
    plan = build_fetch_plan(config, client)

    manifest_path = cache_dir / "taxa.json"
    temporary_manifest_path = manifest_path.with_suffix(".json.tmp")
    temporary_manifest_path.write_text(
        json.dumps(fetch_plan_manifest(plan), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_manifest_path.replace(manifest_path)

    metadata_path = cache_dir / "observations.jsonl"
    known_metadata_keys = _load_metadata_keys(metadata_path)
    allowed_licenses = _allowed_licenses(filters)
    with metadata_path.open("a", encoding="utf-8") as metadata_file:
        for item in tqdm(plan, desc="Fetching taxa"):
            taxon = item.taxon
            taxon_dir = output_dir / taxon.class_dir_name
            taxon_dir.mkdir(parents=True, exist_ok=True)
            observations = client.observations(
                _observation_search_params(place=place, filters=filters, taxon_id=taxon.id),
                per_page=int(limits["per_page"]),
                max_results=item.max_images,
            )
            saved = _download_taxon_photos(
                observations,
                taxon,
                item.group,
                taxon_dir,
                known_metadata_keys,
                max_images=item.max_images,
                max_workers=int(limits.get("download_workers", 8)),
                allowed_licenses=allowed_licenses,
            )
            for metadata in saved:
                metadata_file.write(json.dumps(metadata, ensure_ascii=False) + "\n")
                metadata_file.flush()
            time.sleep(float(limits["request_sleep_seconds"]))


def _allowed_licenses(filters: dict[str, Any]) -> list[str] | None:
    """`filters.allowed_photo_licenses` を正規化して返す。未指定なら None(フィルタなし)。

    公開可能なデータセットを作る場合は cc0 / cc-by だけを許可する。
    キーを持たない既存設定の挙動は変えない。
    """
    allowed = filters.get("allowed_photo_licenses")
    if not allowed:
        return None
    normalized: list[str] = []
    for code in allowed:
        cleaned = str(code).strip().lower()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def _observation_search_params(
    *,
    place: dict[str, Any],
    filters: dict[str, Any],
    taxon_id: int,
) -> dict[str, Any]:
    params = {
        "place_id": place["id"],
        "taxon_id": taxon_id,
        "quality_grade": filters["quality_grade"],
        "photos": str(filters["photos"]).lower(),
        "order": filters.get("observation_order", filters.get("order", "desc")),
        "order_by": filters.get(
            "observation_order_by",
            filters.get("order_by", "observed_on"),
        ),
    }
    allowed = _allowed_licenses(filters)
    if allowed is not None:
        # API 側でも絞る。個々の写真ライセンスは _download_first_photo で再確認する
        # (photo_license は観察に許可ライセンスの写真が 1 枚でもあれば一致するため)。
        params["photo_license"] = ",".join(allowed)
    return params


def fetch_dataset_cli() -> None:
    parser = argparse.ArgumentParser(description="Fetch Phase 0 iNaturalist images.")
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    fetch_dataset(args.config)


def build_fetch_plan(config: dict[str, Any], client) -> list[TaxonFetchPlanItem]:
    taxa_config = config["taxa"]
    limits = config["limits"]
    filters = config["filters"]
    place = config["place"]
    per_page = int(limits["per_page"])
    plan: list[TaxonFetchPlanItem] = []
    claimed_taxon_ids: set[int] = set()

    if "observed_species" in taxa_config:
        observed_config = taxa_config["observed_species"]
        if observed_config["strategy"] != "all_observed_species":
            raise ValueError("taxa.observed_species.strategy must be all_observed_species")
        params = {
            "place_id": int(place["id"]),
            "quality_grade": filters["quality_grade"],
            "photos": str(filters["photos"]).lower(),
            "rank": filters["rank"],
            "order": filters.get("species_order", filters.get("order", "desc")),
            "order_by": filters.get(
                "species_order_by",
                filters.get("order_by", "observations_count"),
            ),
        }
        allowed_licenses = _allowed_licenses(filters)
        if allowed_licenses is not None:
            params["photo_license"] = ",".join(allowed_licenses)
        if root_taxon_id := observed_config.get("root_taxon_id"):
            params["taxon_id"] = int(root_taxon_id)
        taxa = client.species_counts(
            params,
            per_page=per_page,
            max_taxa=observed_config.get("max_taxa"),
            request_sleep_seconds=float(limits.get("request_sleep_seconds", 0.0)),
        )
        minimum_images = int(limits["min_images_per_taxon"])
        for taxon in taxa:
            if taxon.observations_count < minimum_images:
                continue
            _append_plan_item(
                plan,
                claimed_taxon_ids,
                taxon,
                group="observed_species",
                max_images=int(limits["images_per_taxon"]),
            )
        return plan

    for target in taxa_config["target"]:
        taxon = client.resolve_taxon(target["scientific_name"])
        _append_plan_item(
            plan,
            claimed_taxon_ids,
            taxon,
            group="target",
            max_images=int(limits["target_images_per_taxon"]),
        )

    hard_config = taxa_config["hard_negatives"]
    hard_root = client.resolve_taxon(hard_config["root_scientific_name"])
    for taxon in _species_for_group(
        client,
        place_id=int(place["id"]),
        root_taxon_id=hard_root.id,
        filters=filters,
        per_page=per_page,
        strategy=hard_config["strategy"],
        max_taxa=hard_config.get("max_taxa"),
    ):
        _append_plan_item(
            plan,
            claimed_taxon_ids,
            taxon,
            group="hard_negative",
            max_images=int(limits["hard_negative_images_per_taxon"]),
        )

    common_config = taxa_config["common_negatives"]
    common_root = client.resolve_taxon(common_config["root_scientific_name"])
    common_added = 0
    common_max_taxa = int(common_config["max_taxa"])
    for taxon in _species_for_group(
        client,
        place_id=int(place["id"]),
        root_taxon_id=common_root.id,
        filters=filters,
        per_page=per_page,
        strategy=common_config["strategy"],
        max_taxa=None,
    ):
        before_count = len(plan)
        _append_plan_item(
            plan,
            claimed_taxon_ids,
            taxon,
            group="common_negative",
            max_images=int(limits["common_negative_images_per_taxon"]),
        )
        if len(plan) > before_count:
            common_added += 1
        if common_added >= common_max_taxa:
            break
    return plan


def fetch_plan_manifest(plan: list[TaxonFetchPlanItem]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "taxa": [
            {
                "id": item.taxon.id,
                "scientificName": item.taxon.scientific_name,
                "preferredCommonName": item.taxon.preferred_common_name,
                "classDirName": item.taxon.class_dir_name,
                "observationsCount": item.taxon.observations_count,
                "group": item.group,
                "maxImages": item.max_images,
            }
            for item in plan
        ],
    }


def _append_plan_item(
    plan: list[TaxonFetchPlanItem],
    claimed_taxon_ids: set[int],
    taxon: Taxon,
    *,
    group: str,
    max_images: int,
) -> None:
    if taxon.id in claimed_taxon_ids:
        return
    claimed_taxon_ids.add(taxon.id)
    plan.append(TaxonFetchPlanItem(taxon=taxon, group=group, max_images=max_images))


def _species_for_group(
    client,
    *,
    place_id: int,
    root_taxon_id: int,
    filters: dict[str, Any],
    per_page: int,
    strategy: str,
    max_taxa: int | None,
) -> list[Taxon]:
    if strategy not in {"all_observed_species", "top_observed_species"}:
        raise ValueError("taxa group strategy must be all_observed_species or top_observed_species")
    return client.species_counts(
        {
            "place_id": place_id,
            "taxon_id": root_taxon_id,
            "quality_grade": filters["quality_grade"],
            "photos": str(filters["photos"]).lower(),
            "rank": filters["rank"],
            "order": filters.get("species_order", filters.get("order", "desc")),
            "order_by": filters.get(
                "species_order_by",
                filters.get("order_by", "observations_count"),
            ),
        },
        per_page=per_page,
        max_taxa=max_taxa,
    )


def _download_taxon_photos(
    observations: list[dict[str, Any]],
    taxon: Taxon,
    group: str,
    taxon_dir: Path,
    known_metadata_keys: set[str],
    *,
    max_images: int,
    max_workers: int,
    allowed_licenses: list[str] | None = None,
) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as executor:
        futures = [
            executor.submit(
                _download_first_photo,
                observation,
                taxon,
                group,
                taxon_dir,
                allowed_licenses=allowed_licenses,
            )
            for observation in observations
        ]
        for future in as_completed(futures):
            try:
                metadata = future.result()
            except requests.RequestException:
                continue
            if metadata is None:
                continue
            key = _metadata_key(metadata)
            if key in known_metadata_keys:
                continue
            known_metadata_keys.add(key)
            saved.append(metadata)
            if len(saved) >= max_images:
                break
    return saved


def _load_metadata_keys(metadata_path: Path) -> set[str]:
    if not metadata_path.exists():
        return set()
    keys: set[str] = set()
    with metadata_path.open("r", encoding="utf-8") as metadata_file:
        for line in metadata_file:
            if not line.strip():
                continue
            try:
                keys.add(_metadata_key(json.loads(line)))
            except json.JSONDecodeError:
                continue
    return keys


def _metadata_key(metadata: dict[str, Any]) -> str:
    return (
        f"{metadata.get('observation_id')}:{metadata.get('taxon_id')}:{metadata.get('photo_url')}"
    )


def _download_first_photo(
    observation: dict[str, Any],
    taxon: Taxon,
    group: str,
    taxon_dir: Path,
    *,
    allowed_licenses: list[str] | None = None,
) -> dict[str, Any] | None:
    photos = observation.get("photos") or []
    if not photos:
        return None
    photo = photos[0]
    license_code = photo.get("license_code") or observation.get("license_code")
    # フィルタ有効時はライセンス不明の写真も除外する(プロダクト利用可の確証がないため)
    if allowed_licenses is not None and (
        license_code is None or str(license_code).lower() not in allowed_licenses
    ):
        return None
    url = _best_photo_url(photo)
    if not url:
        return None
    suffix = Path(url.split("?")[0]).suffix or ".jpg"
    digest = hashlib.sha256(f"{observation.get('id')}:{url}".encode()).hexdigest()[:16]
    image_path = taxon_dir / f"{observation.get('id')}_{digest}{suffix}"
    if not image_path.exists():
        response = _get_with_retries(requests, url, params=None, timeout_seconds=30)
        response.raise_for_status()
        image_path.write_bytes(response.content)
    try:
        with Image.open(image_path) as image:
            image.verify()
    except Exception:
        image_path.unlink(missing_ok=True)
        return None
    return {
        "observation_id": observation.get("id"),
        "taxon_id": taxon.id,
        "scientific_name": taxon.scientific_name,
        "preferred_common_name": taxon.preferred_common_name,
        "group": group,
        "photo_url": url,
        "local_path": str(image_path),
        "license_code": license_code,
        # CC-BY のクレジット表記義務に備えて出典を残す(docs/ml-product-plan.md)
        "attribution": photo.get("attribution"),
    }


def _best_photo_url(photo: dict[str, Any]) -> str | None:
    url = photo.get("url")
    if not isinstance(url, str):
        return None
    return url.replace("square.", "medium.")


def _get_with_retries(session, url: str, *, params: dict[str, Any] | None, timeout_seconds: int):
    last_error: requests.RequestException | None = None
    for attempt in range(4):
        try:
            response = session.get(url, params=params, timeout=timeout_seconds)
            response.raise_for_status()
            return response
        except requests.RequestException as error:
            last_error = error
            time.sleep(0.5 * (2**attempt))
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Request failed without an exception: {url}")
