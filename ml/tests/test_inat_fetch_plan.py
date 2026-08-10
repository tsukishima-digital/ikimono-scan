from ikimono_scan_ml.inat import Taxon, build_fetch_plan


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
