from pathlib import Path
from subprocess import CompletedProcess

import pytest

from scripts.production_apply import (
    AUDITED_CLOUDFLARE_PROVIDER_VERSION,
    apply_production_plan,
    cloudflare_provider_version,
    is_startup_time_inconsistency,
)

STARTUP_TIME_FAILURE = """
Error: Provider produced inconsistent result after apply
When applying changes to cloudflare_workers_script.app, provider
produced an unexpected new value: .startup_time_ms: was cty.NumberIntVal(5),
but now cty.NumberIntVal(3).
"""


class TerraformRun:
    def __init__(self, results: list[CompletedProcess[str]]) -> None:
        self.results = iter(results)
        self.commands: list[list[str]] = []

    def __call__(self, command: list[str]) -> CompletedProcess[str]:
        self.commands.append(command)
        return next(self.results)


def result(returncode: int, output: str = "") -> CompletedProcess[str]:
    return CompletedProcess([], returncode, output, "")


def test_only_the_known_worker_startup_time_inconsistency_is_recoverable():
    assert is_startup_time_inconsistency(STARTUP_TIME_FAILURE)
    assert not is_startup_time_inconsistency(
        STARTUP_TIME_FAILURE.replace(
            "cloudflare_workers_script.app", "cloudflare_workers_script.other"
        )
    )
    assert not is_startup_time_inconsistency(
        STARTUP_TIME_FAILURE.replace(".startup_time_ms", ".etag")
    )
    assert not is_startup_time_inconsistency("Error: permission denied")


def test_successful_apply_does_not_run_recovery(tmp_path: Path):
    terraform = TerraformRun([result(0, "Apply complete")])

    recovered = apply_production_plan(tmp_path / "production.tfplan", run=terraform)

    assert recovered is False
    assert len(terraform.commands) == 1


def test_known_inconsistency_is_reconciled_only_when_the_new_plan_is_empty(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    terraform = TerraformRun(
        [
            result(1, STARTUP_TIME_FAILURE),
            result(0, "No changes"),
            result(0, "Apply complete! Resources: 0 added, 0 changed, 0 destroyed."),
        ]
    )

    recovered = apply_production_plan(tmp_path / "production.tfplan", run=terraform)

    assert recovered is True
    assert terraform.commands[1][2:5] == [
        "plan",
        "-input=false",
        "-lock-timeout=5m",
    ]
    assert "-detailed-exitcode" in terraform.commands[1]
    assert terraform.commands[2][2] == "apply"
    assert "Cloudflare Provider workaround" in summary.read_text()


@pytest.mark.parametrize(
    ("first_failure", "recovery_plan_exit"),
    [("Error: permission denied", None), (STARTUP_TIME_FAILURE, 2), (STARTUP_TIME_FAILURE, 1)],
)
def test_other_failures_and_recovery_diffs_remain_failures(
    tmp_path: Path, first_failure: str, recovery_plan_exit: int | None
):
    results = [result(1, first_failure)]
    if recovery_plan_exit is not None:
        results.append(result(recovery_plan_exit, "unexpected recovery result"))
    terraform = TerraformRun(results)

    with pytest.raises(RuntimeError):
        apply_production_plan(tmp_path / "production.tfplan", run=terraform)


def test_failed_state_reconciliation_remains_a_failure(tmp_path: Path):
    terraform = TerraformRun(
        [result(1, STARTUP_TIME_FAILURE), result(0, "No changes"), result(1, "apply failed")]
    )

    with pytest.raises(RuntimeError, match="state reconciliation failed"):
        apply_production_plan(tmp_path / "production.tfplan", run=terraform)


def test_cloudflare_provider_updates_require_a_workaround_audit(tmp_path: Path):
    lockfile = tmp_path / ".terraform.lock.hcl"
    lockfile.write_text(
        'provider "registry.terraform.io/cloudflare/cloudflare" {\n  version = "5.23.0"\n}\n'
    )

    assert cloudflare_provider_version(lockfile) == AUDITED_CLOUDFLARE_PROVIDER_VERSION


def test_tracked_cloudflare_provider_has_been_audited_for_the_workaround():
    lockfile = Path(__file__).parents[2] / "infra" / "production" / ".terraform.lock.hcl"

    assert cloudflare_provider_version(lockfile) == AUDITED_CLOUDFLARE_PROVIDER_VERSION, (
        "Audit the startup_time_ms workaround against the new Cloudflare provider. "
        "Remove it after two Worker-changing production deploys succeed without the workaround; "
        "otherwise update AUDITED_CLOUDFLARE_PROVIDER_VERSION."
    )
