import subprocess
from pathlib import Path

from scripts import terraform_backend


def test_lock_probe_uses_a_regular_file_for_the_aws_blob(monkeypatch):
    commands: list[list[str]] = []
    body_paths: list[Path] = []

    monkeypatch.setattr(terraform_backend, "_environment", lambda: {})

    def record_run(command, **_kwargs):
        commands.append(command)
        if "--body" in command:
            body_path = Path(command[command.index("--body") + 1])
            assert body_path.is_file()
            body_paths.append(body_path)
        return subprocess.CompletedProcess(command, 0)

    def reject_duplicate(command, **_kwargs):
        body_path = Path(command[command.index("--body") + 1])
        assert body_path.is_file()
        body_paths.append(body_path)
        return subprocess.CompletedProcess(command, 1)

    monkeypatch.setattr(terraform_backend, "_run", record_run)
    monkeypatch.setattr(terraform_backend.subprocess, "run", reject_duplicate)

    terraform_backend.lock_test()

    assert len(body_paths) == 2
    assert body_paths[0] == body_paths[1]
    assert not body_paths[0].exists()
    assert commands[-1][1:3] == ["s3api", "delete-object"]
