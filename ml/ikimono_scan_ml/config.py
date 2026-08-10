from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


def load_yaml(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as config_file:
        data = yaml.safe_load(config_file)
    if not isinstance(data, dict):
        raise ValueError(f"Config must be a mapping: {path}")
    return data


def project_path(value: str | Path, *, root: Path | None = None) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (root or Path.cwd()) / path


@dataclass(frozen=True)
class PredictionPolicy:
    confidence_threshold: float
    target_scientific_name: str

    @classmethod
    def from_values(
        cls,
        *,
        confidence_threshold: float = 0.6,
        target_scientific_name: str = "Aromia bungii",
    ) -> PredictionPolicy:
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be between 0.0 and 1.0")
        return cls(
            confidence_threshold=confidence_threshold,
            target_scientific_name=target_scientific_name,
        )
