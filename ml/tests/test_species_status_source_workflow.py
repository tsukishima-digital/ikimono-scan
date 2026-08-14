from pathlib import Path


def test_species_status_source_workflow_runs_weekly_and_opens_one_review_issue() -> None:
    source = Path(".github/workflows/species-status-sources.yml").read_text(encoding="utf-8")

    assert 'cron: "30 18 * * 0"' in source
    assert "workflow_dispatch:" in source
    assert "issues: write" in source
    assert (
        "PYTHONPATH=ml python scripts/check_species_status_sources.py "
        "ml/taxonomy/species-status-registry.json"
    ) in source
    assert "gh issue list" in source
    assert "gh issue create" in source
    assert "gh issue comment" in source
    assert "task species-status:specified:refresh" in source
