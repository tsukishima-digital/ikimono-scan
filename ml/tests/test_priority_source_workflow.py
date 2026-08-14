from pathlib import Path


def test_priority_source_workflow_runs_weekly_and_opens_one_review_issue() -> None:
    source = Path(".github/workflows/priority-sources.yml").read_text(encoding="utf-8")

    assert 'cron: "30 18 * * 0"' in source
    assert "workflow_dispatch:" in source
    assert "issues: write" in source
    assert (
        "PYTHONPATH=ml python scripts/check_priority_sources.py ml/taxonomy/priority-registry.json"
    ) in source
    assert "gh issue list" in source
    assert "gh issue create" in source
    assert "gh issue comment" in source
    assert "task priority:specified:refresh" in source
