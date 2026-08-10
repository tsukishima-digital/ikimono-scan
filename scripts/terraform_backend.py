"""Operate the R2-backed Terraform state lifecycle without persisting credentials."""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[1]
INFRA_ROOT = REPOSITORY_ROOT / "infra"
STATE_BUCKET = "ikimono-scan-terraform-state"
ROOTS = {"bootstrap", "production", "storage"}


def _environment() -> dict[str, str]:
    environment = os.environ.copy()
    required = (
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
    )
    missing = [name for name in required if not environment.get(name)]
    if missing:
        raise SystemExit(f"Missing environment variables: {', '.join(missing)}")

    account_id = environment["CLOUDFLARE_ACCOUNT_ID"]
    environment["AWS_ENDPOINT_URL_S3"] = f"https://{account_id}.r2.cloudflarestorage.com"
    environment["AWS_REGION"] = "auto"
    environment["TF_VAR_cloudflare_account_id"] = account_id
    return environment


def _run(
    command: list[str],
    *,
    cwd: Path | None = None,
    environment: dict[str, str] | None = None,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        cwd=cwd,
        env=environment,
        text=True,
        capture_output=capture_output,
    )


def _terraform(root: str, *arguments: str, environment: dict[str, str]) -> None:
    _run(
        ["terraform", f"-chdir={INFRA_ROOT / root}", *arguments],
        environment=environment,
    )


def _backend_exists(environment: dict[str, str]) -> bool:
    result = subprocess.run(
        ["aws", "s3api", "head-bucket", "--bucket", STATE_BUCKET],
        check=False,
        env=environment,
        text=True,
        capture_output=True,
    )
    if result.returncode == 0:
        return True
    if "404" in result.stderr or "Not Found" in result.stderr or "NoSuchBucket" in result.stderr:
        return False
    raise SystemExit(f"Unable to inspect the Terraform backend: {result.stderr.strip()}")


def bootstrap_plan() -> None:
    environment = _environment()
    with tempfile.TemporaryDirectory(prefix="ikimono-scan-bootstrap-plan-") as temporary:
        temporary_root = Path(temporary)
        for source in (INFRA_ROOT / "bootstrap").glob("*.tf"):
            if source.name != "backend.tf":
                shutil.copy2(source, temporary_root / source.name)
        _run(["terraform", "init", "-input=false"], cwd=temporary_root, environment=environment)
        _run(["terraform", "plan", "-input=false"], cwd=temporary_root, environment=environment)


def bootstrap() -> None:
    environment = _environment()
    bootstrap_root = INFRA_ROOT / "bootstrap"

    if _backend_exists(environment):
        _terraform("bootstrap", "init", "-input=false", environment=environment)
        listed = _run(
            ["terraform", f"-chdir={bootstrap_root}", "state", "list"],
            environment=environment,
            capture_output=True,
        ).stdout.splitlines()
        if "cloudflare_r2_bucket.terraform_state" not in listed:
            _terraform(
                "bootstrap",
                "import",
                "cloudflare_r2_bucket.terraform_state",
                f"{environment['CLOUDFLARE_ACCOUNT_ID']}/{STATE_BUCKET}",
                environment=environment,
            )
        return

    with tempfile.TemporaryDirectory(prefix="ikimono-scan-bootstrap-") as temporary:
        temporary_root = Path(temporary)
        for source in bootstrap_root.glob("*.tf"):
            if source.name != "backend.tf":
                shutil.copy2(source, temporary_root / source.name)

        plan_path = temporary_root / "bootstrap.tfplan"
        _run(["terraform", "init", "-input=false"], cwd=temporary_root, environment=environment)
        _run(
            ["terraform", "plan", "-input=false", f"-out={plan_path}"],
            cwd=temporary_root,
            environment=environment,
        )
        _run(
            ["terraform", "apply", "-input=false", str(plan_path)],
            cwd=temporary_root,
            environment=environment,
        )
        shutil.copy2(temporary_root / "terraform.tfstate", bootstrap_root / "terraform.tfstate")

    _terraform(
        "bootstrap",
        "init",
        "-input=false",
        "-migrate-state",
        "-force-copy",
        environment=environment,
    )
    _terraform("bootstrap", "state", "list", environment=environment)


def backup(root: str, label: str) -> None:
    if root not in ROOTS:
        raise SystemExit(f"Unsupported Terraform root: {root}")
    environment = _environment()

    with tempfile.TemporaryDirectory(prefix="ikimono-scan-state-backup-") as temporary:
        state_path = Path(temporary) / "terraform.tfstate"
        result = _run(
            ["terraform", f"-chdir={INFRA_ROOT / root}", "state", "pull"],
            environment=environment,
            capture_output=True,
        )
        state_path.write_text(result.stdout)
        digest = hashlib.sha256(state_path.read_bytes()).hexdigest()
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        key = f"backups/{root}/{timestamp}-{label}-{digest}.tfstate"
        _run(
            [
                "aws",
                "s3",
                "cp",
                str(state_path),
                f"s3://{STATE_BUCKET}/{key}",
                "--cache-control",
                "no-store",
            ],
            environment=environment,
        )
        print(f"Saved state backup: s3://{STATE_BUCKET}/{key}")


def lock_test() -> None:
    environment = _environment()
    nonce = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    key = f"lock-tests/{nonce}.tflock"
    with tempfile.TemporaryDirectory(prefix="ikimono-scan-lock-test-") as temporary:
        body_path = Path(temporary) / "empty-lock"
        body_path.touch()
        command = [
            "aws",
            "s3api",
            "put-object",
            "--bucket",
            STATE_BUCKET,
            "--key",
            key,
            "--body",
            str(body_path),
            "--if-none-match",
            "*",
        ]
        _run(command, environment=environment)
        try:
            collision = subprocess.run(
                command,
                check=False,
                env=environment,
                text=True,
                capture_output=True,
            )
            if collision.returncode == 0:
                raise SystemExit(
                    "R2 accepted a duplicate conditional write; state locking is unsafe"
                )
        finally:
            _run(
                [
                    "aws",
                    "s3api",
                    "delete-object",
                    "--bucket",
                    STATE_BUCKET,
                    "--key",
                    key,
                ],
                environment=environment,
            )


def main() -> int:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("bootstrap-plan")
    subcommands.add_parser("bootstrap")
    backup_parser = subcommands.add_parser("backup")
    backup_parser.add_argument("root", choices=sorted(ROOTS))
    backup_parser.add_argument("label", choices=("pre-apply", "post-apply"))
    subcommands.add_parser("lock-test")
    arguments = parser.parse_args()

    if arguments.command == "bootstrap-plan":
        bootstrap_plan()
    elif arguments.command == "bootstrap":
        bootstrap()
    elif arguments.command == "backup":
        backup(arguments.root, arguments.label)
    else:
        lock_test()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
