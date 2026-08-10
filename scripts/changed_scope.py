"""Select the code checks affected by a set of repository paths."""

from __future__ import annotations

import argparse
import subprocess
from collections.abc import Iterable


def scopes_for_paths(paths: Iterable[str]) -> set[str]:
    scopes: set[str] = set()
    for path in paths:
        if path.startswith("web/"):
            scopes.add("web")
        if path.startswith("infra/") or path in {"Taskfile.yml"}:
            scopes.add("infra")
        if path.startswith(("ml/", "scripts/")) or path in {
            ".pre-commit-config.yaml",
            "pyproject.toml",
            "uv.lock",
        }:
            scopes.add("python")
        if path == ".github/workflows/ci.yml":
            scopes.update(("infra", "python", "web"))
        if path in {
            ".github/workflows/deploy.yml",
            ".github/workflows/terraform-plan.yml",
        }:
            scopes.update(("infra", "web"))
    return scopes


def _git_paths(*arguments: str) -> set[str]:
    result = subprocess.run(
        ["git", *arguments],
        check=True,
        capture_output=True,
        text=True,
    )
    return {path for path in result.stdout.splitlines() if path}


def working_tree_paths() -> set[str]:
    return _git_paths("diff", "--name-only", "HEAD") | _git_paths(
        "ls-files", "--others", "--exclude-standard"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--working-tree", action="store_true")
    source.add_argument("--base")
    parser.add_argument("--head")
    parser.add_argument("--scope", choices=("infra", "python", "web"))
    args = parser.parse_args()

    if args.base:
        if not args.head or not args.scope:
            parser.error("--base requires --head and --scope")
        paths = _git_paths("diff", "--name-only", args.base, args.head)
        return 0 if args.scope in scopes_for_paths(paths) else 1

    if args.head or args.scope:
        parser.error("--head and --scope are only valid with --base")
    print("\n".join(sorted(scopes_for_paths(working_tree_paths()))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
