"""Tensorだけで構成された学習checkpointを安全に読み込む。"""

from pathlib import Path
from typing import Any

import torch


def load_checkpoint(
    path: str | Path,
    *,
    map_location: str | torch.device,
) -> dict[str, Any]:
    """Pickleの任意globalを許可せず、mapping形式のcheckpointを返す。"""
    checkpoint = torch.load(path, map_location=map_location, weights_only=True)
    if not isinstance(checkpoint, dict):
        raise TypeError("Checkpoint must be a mapping")
    return checkpoint
