"""Run the local web app through the Access-protected Cloudflare Tunnel."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[1]
DEFAULT_WEB_ROOT = REPOSITORY_ROOT / "web"
PREVIEW_HOSTNAME = "dev.ikimono-scan.app"
PREVIEW_URL = f"https://{PREVIEW_HOSTNAME}"
TUNNEL_NAME = "ikimono-scan-preview"


def vite_command() -> list[str]:
    """Return the fixed local origin command configured in Terraform."""
    return [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "5175",
        "--strictPort",
    ]


def tunnel_command() -> list[str]:
    """Return the repository-pinned Wrangler command for the named tunnel."""
    return ["npm", "exec", "--", "wrangler", "tunnel", "run", TUNNEL_NAME]


def resolve_web_root(configured_root: str | None) -> Path:
    """Resolve a web package used as the preview UI and reject invalid directories."""
    root = Path(configured_root) if configured_root else DEFAULT_WEB_ROOT
    if not root.is_absolute():
        root = REPOSITORY_ROOT / root
    root = root.resolve()
    if not (root / "package.json").is_file():
        raise ValueError(f"preview UI root must contain package.json: {root}")
    return root


def preview_environment(base: dict[str, str]) -> dict[str, str]:
    """Return the Vite environment accepted by the preview tunnel hostname."""
    environment = base.copy()
    environment["__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS"] = PREVIEW_HOSTNAME
    return environment


def stop_process(process: subprocess.Popen[bytes] | None) -> None:
    """Stop a child process group and wait for it to exit."""
    if process is None or process.poll() is not None:
        return
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def run_preview() -> None:
    """Run Vite and Cloudflare Tunnel together until interrupted."""
    web_root = resolve_web_root(os.environ.get("IKIMONO_SCAN_WEB_ROOT"))
    environment = preview_environment(os.environ.copy())

    print(f"スマホで開く: {PREVIEW_URL}", flush=True)
    print(f"UI: {web_root}", flush=True)
    print("Cloudflare Accessでログインしてください。", flush=True)
    print("終了するには Ctrl+C を押してください。", flush=True)

    vite: subprocess.Popen[bytes] | None = None
    tunnel: subprocess.Popen[bytes] | None = None
    try:
        vite = subprocess.Popen(
            vite_command(),
            cwd=web_root,
            env=environment,
            start_new_session=True,
        )
        tunnel = subprocess.Popen(
            tunnel_command(),
            cwd=DEFAULT_WEB_ROOT,
            env=environment,
            start_new_session=True,
        )

        while vite.poll() is None and tunnel.poll() is None:
            time.sleep(0.25)
        if vite.poll() is not None:
            raise RuntimeError("Vite開発サーバーが終了しました。")
        raise RuntimeError(
            "Cloudflare Tunnelが終了しました。Wranglerのログイン状態を確認してください。"
        )
    except KeyboardInterrupt:
        print("\nスマホプレビューを終了します。", flush=True)
    finally:
        stop_process(tunnel)
        stop_process(vite)


def main() -> int:
    try:
        run_preview()
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"エラー: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
