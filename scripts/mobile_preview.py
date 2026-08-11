"""Run the local web app through the Access-protected Cloudflare Tunnel."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[1]
WEB_ROOT = REPOSITORY_ROOT / "web"
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
    environment = os.environ.copy()
    environment["__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS"] = PREVIEW_HOSTNAME

    print(f"スマホで開く: {PREVIEW_URL}", flush=True)
    print("Cloudflare Accessでログインしてください。", flush=True)
    print("終了するには Ctrl+C を押してください。", flush=True)

    vite: subprocess.Popen[bytes] | None = None
    tunnel: subprocess.Popen[bytes] | None = None
    try:
        vite = subprocess.Popen(
            vite_command(),
            cwd=WEB_ROOT,
            env=environment,
            start_new_session=True,
        )
        tunnel = subprocess.Popen(
            tunnel_command(),
            cwd=WEB_ROOT,
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
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"エラー: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
