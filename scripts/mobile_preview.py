"""Run the local web app through a private Tailscale Serve endpoint."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).parents[1]
MACOS_TAILSCALE = Path("/Applications/Tailscale.app/Contents/MacOS/Tailscale")


def tailscale_executable() -> str:
    """Return an available Tailscale CLI path or raise a setup error."""
    override = os.environ.get("TAILSCALE_BIN")
    executable = override or shutil.which("tailscale")
    if executable:
        return executable
    if MACOS_TAILSCALE.is_file():
        return str(MACOS_TAILSCALE)
    raise RuntimeError("Tailscale CLIが見つかりません。Tailscaleをインストールしてください。")


def tailnet_hostname(status: dict[str, Any]) -> str:
    """Return the reachable node DNS name from `tailscale status --json`."""
    node = status.get("Self", {})
    hostname = node.get("DNSName", "").rstrip(".")
    if status.get("BackendState") != "Running" or not node.get("Online") or not hostname:
        raise RuntimeError("Tailscaleに接続してから、もう一度実行してください。")
    return hostname


def read_tailscale_status(executable: str) -> dict[str, Any]:
    """Read the current node status through the selected Tailscale CLI."""
    result = subprocess.run(
        [executable, "status", "--json"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def stop_process(process: subprocess.Popen[bytes] | None) -> None:
    """Stop a child command and its process group, escalating after a timeout."""
    if process is None or process.poll() is not None:
        return
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def run_preview(port: int) -> None:
    """Run Vite and a foreground Tailscale Serve proxy until interrupted."""
    executable = tailscale_executable()
    hostname = tailnet_hostname(read_tailscale_status(executable))
    environment = os.environ.copy()
    environment["__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS"] = hostname

    print(f"スマホで開く: https://{hostname}", flush=True)
    print("終了するには Ctrl+C を押してください。", flush=True)

    vite: subprocess.Popen[bytes] | None = None
    serve: subprocess.Popen[bytes] | None = None
    try:
        vite = subprocess.Popen(
            [
                "npm",
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--strictPort",
            ],
            cwd=REPOSITORY_ROOT / "web",
            env=environment,
            start_new_session=True,
        )
        serve = subprocess.Popen(
            [executable, "serve", "--yes", str(port)],
            start_new_session=True,
        )

        while vite.poll() is None and serve.poll() is None:
            time.sleep(0.25)
        if vite.poll() is not None:
            raise RuntimeError("Vite開発サーバーが終了しました。")
        raise RuntimeError("Tailscale Serveが終了しました。")
    except KeyboardInterrupt:
        print("\nスマホプレビューを終了します。", flush=True)
    finally:
        stop_process(serve)
        stop_process(vite)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5175)
    args = parser.parse_args()
    try:
        run_preview(args.port)
    except (OSError, RuntimeError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        print(f"エラー: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
