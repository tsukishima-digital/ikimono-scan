"""Apply the production Terraform plan with a narrow Cloudflare state reconciliation."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
from collections.abc import Callable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[1]
PRODUCTION_ROOT = REPOSITORY_ROOT / "infra" / "production"
# Implementation: Provider 5.23.0 regressed cloudflare/terraform-provider-cloudflare#5704.
# Audit every Dependabot version bump, and remove this recovery after two Worker-changing
# production deploys on a newer provider succeed without the startup_time_ms error.
AUDITED_CLOUDFLARE_PROVIDER_VERSION = "5.23.0"

TerraformRun = Callable[[list[str]], subprocess.CompletedProcess[str]]


def cloudflare_provider_version(lockfile: Path) -> str:
    """Return the Cloudflare provider version selected by a Terraform lockfile."""
    match = re.search(
        r'provider "registry\.terraform\.io/cloudflare/cloudflare"\s*\{.*?'
        r'version\s*=\s*"([^"]+)"',
        lockfile.read_text(),
        re.DOTALL,
    )
    if not match:
        raise ValueError(f"Cloudflare provider version is missing from {lockfile}")
    return match.group(1)


def is_startup_time_inconsistency(output: str) -> bool:
    """Return whether Terraform reported the known mutable startup-time state bug."""
    required_fragments = (
        "Provider produced inconsistent result after apply",
        "cloudflare_workers_script.app",
        ".startup_time_ms",
    )
    return all(fragment in output for fragment in required_fragments)


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, text=True, capture_output=True)


def _show(result: subprocess.CompletedProcess[str]) -> str:
    output = f"{result.stdout or ''}{result.stderr or ''}"
    if output:
        print(output, end="" if output.endswith("\n") else "\n")
    return output


def _record_recovery() -> None:
    message = (
        "Cloudflare provider returned a different workers_script startup_time_ms after apply; "
        "the deployment reconciled the resulting no-op state."
    )
    print(f"::warning title=Cloudflare Terraform workaround used::{message}")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a") as summary:
            summary.write("## Cloudflare Provider workaround\n\n")
            summary.write(f"{message}\n")


def apply_production_plan(
    plan_path: Path,
    *,
    run: TerraformRun = _run,
) -> bool:
    """Apply a saved plan, reconciling only the known Cloudflare startup-time bug.

    Returns whether reconciliation was required. Any other apply error, any new
    recovery-plan difference, or a failed reconciliation raises ``RuntimeError``.
    """
    terraform = ["terraform", f"-chdir={PRODUCTION_ROOT}"]
    first_apply = run([*terraform, "apply", "-input=false", str(plan_path)])
    first_output = _show(first_apply)
    if first_apply.returncode == 0:
        return False
    if not is_startup_time_inconsistency(first_output):
        raise RuntimeError("Production Terraform apply failed")

    _record_recovery()
    recovery_plan = plan_path.with_name("production-recovery.tfplan")
    recovery = run(
        [
            *terraform,
            "plan",
            "-input=false",
            "-lock-timeout=5m",
            "-detailed-exitcode",
            f"-out={recovery_plan}",
        ]
    )
    _show(recovery)
    if recovery.returncode != 0:
        if recovery.returncode == 2:
            raise RuntimeError(
                "Cloudflare startup-time recovery found configuration differences; "
                "refusing to apply"
            )
        raise RuntimeError("Cloudflare startup-time recovery plan failed")

    reconciled = run([*terraform, "apply", "-input=false", str(recovery_plan)])
    _show(reconciled)
    if reconciled.returncode != 0:
        raise RuntimeError("Cloudflare startup-time state reconciliation failed")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("plan", type=Path)
    arguments = parser.parse_args()
    apply_production_plan(arguments.plan)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
