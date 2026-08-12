from ikimono_scan_ml import inat
from ikimono_scan_ml.config import load_yaml
from ikimono_scan_ml.inat import INaturalistClient, Taxon, build_fetch_plan


class FakeINaturalistClient:
    def __init__(self) -> None:
        self.resolved = {
            "Aromia bungii": 1,
            "Cerambycidae": 10,
            "Coleoptera": 20,
        }
        self.taxa = {
            1: Taxon(1, "Aromia bungii", "クビアカツヤカミキリ", 12),
            2: Taxon(2, "Anoplophora chinensis", "ゴマダラカミキリ", 300),
            3: Taxon(3, "Harmonia axyridis", "ナミテントウ", 500),
            4: Taxon(4, "Coccinella septempunctata", "ナナホシテントウ", 400),
            10: Taxon(10, "Cerambycidae", "カミキリムシ科", 0),
            20: Taxon(20, "Coleoptera", "甲虫目", 0),
        }

    def resolve_taxon(self, scientific_name: str) -> Taxon:
        return self.taxa[self.resolved[scientific_name]]

    def species_counts(self, params, *, per_page: int, max_taxa: int | None = None):
        taxon_id = params["taxon_id"]
        if taxon_id == 10:
            taxa = [self.taxa[1], self.taxa[2]]
        elif taxon_id == 20:
            taxa = [self.taxa[1], self.taxa[2], self.taxa[3], self.taxa[4]]
        else:
            taxa = []
        return taxa if max_taxa is None else taxa[:max_taxa]


def test_fetch_plan_prioritizes_target_then_hard_then_common() -> None:
    config = {
        "place": {"id": 6737},
        "taxa": {
            "target": [{"scientific_name": "Aromia bungii"}],
            "hard_negatives": {
                "root_scientific_name": "Cerambycidae",
                "strategy": "all_observed_species",
            },
            "common_negatives": {
                "root_scientific_name": "Coleoptera",
                "strategy": "top_observed_species",
                "max_taxa": 2,
            },
        },
        "filters": {
            "quality_grade": "research",
            "photos": True,
            "rank": "species",
            "species_order": "desc",
            "species_order_by": "observations_count",
            "observation_order": "desc",
            "observation_order_by": "observed_on",
        },
        "limits": {
            "target_images_per_taxon": 120,
            "hard_negative_images_per_taxon": 80,
            "common_negative_images_per_taxon": 40,
            "per_page": 100,
        },
    }

    plan = build_fetch_plan(config, FakeINaturalistClient())

    assert [(item.taxon.id, item.group, item.max_images) for item in plan] == [
        (1, "target", 120),
        (2, "hard_negative", 80),
        (3, "common_negative", 40),
        (4, "common_negative", 40),
    ]


class FakeJapanSpeciesClient:
    def __init__(self) -> None:
        self.params = None
        self.request_sleep_seconds = None

    def species_counts(
        self,
        params,
        *,
        per_page: int,
        max_taxa: int | None = None,
        request_sleep_seconds: float = 0.0,
    ):
        self.params = params
        self.request_sleep_seconds = request_sleep_seconds
        taxa = [
            Taxon(1, "Abies firma", "モミ", 80),
            Taxon(2, "Aromia bungii", "クビアカツヤカミキリ", 20),
            Taxon(3, "Rare species", None, 19),
        ]
        return taxa if max_taxa is None else taxa[:max_taxa]


def test_fetch_plan_selects_japan_species_meeting_the_image_minimum() -> None:
    client = FakeJapanSpeciesClient()
    config = load_yaml("ml/experiments/japan_species_classifier/configs/dataset.yaml")

    plan = build_fetch_plan(config, client)

    assert [(item.taxon.id, item.group, item.max_images) for item in plan] == [
        (1, "observed_species", 40),
        (2, "observed_species", 40),
    ]
    assert client.params == {
        "place_id": 6737,
        "quality_grade": "research",
        "photos": "true",
        "rank": "species",
        "order": "desc",
        "order_by": "observations_count",
    }
    assert client.request_sleep_seconds == 1.0


def test_arthropoda_fetch_plan_limits_species_counts_to_the_root_taxon() -> None:
    client = FakeJapanSpeciesClient()
    config = load_yaml("ml/experiments/japan_species_classifier/configs/arthropoda_dataset.yaml")

    plan = build_fetch_plan(config, client)

    assert [item.taxon.id for item in plan] == [1, 2]
    assert client.params["taxon_id"] == 47120


def test_fetch_plan_manifest_identifies_reusable_class_directories() -> None:
    plan = [
        inat.TaxonFetchPlanItem(
            taxon=Taxon(47120, "Arthropoda", "節足動物門", 120),
            group="observed_species",
            max_images=40,
        )
    ]

    assert inat.fetch_plan_manifest(plan) == {
        "schemaVersion": 1,
        "taxa": [
            {
                "id": 47120,
                "scientificName": "Arthropoda",
                "preferredCommonName": "節足動物門",
                "classDirName": "47120_arthropoda",
                "observationsCount": 120,
                "group": "observed_species",
                "maxImages": 40,
            }
        ],
    }


def test_species_count_pages_respect_the_configured_request_delay(monkeypatch) -> None:
    client = INaturalistClient("https://example.test/v1")
    requested_pages = []
    slept = []

    def fake_get(path, params):
        requested_pages.append(params["page"])
        page_taxa = {
            1: [(1, "Species one"), (2, "Species two")],
            2: [(3, "Species three")],
        }
        return {
            "results": [
                {"count": 20, "taxon": {"id": taxon_id, "name": name}}
                for taxon_id, name in page_taxa[params["page"]]
            ]
        }

    monkeypatch.setattr(client, "get", fake_get)
    monkeypatch.setattr(inat.time, "sleep", slept.append)

    taxa = client.species_counts({}, per_page=2, request_sleep_seconds=0.75)

    assert [taxon.id for taxon in taxa] == [1, 2, 3]
    assert requested_pages == [1, 2]
    assert slept == [0.75]
