from contextlib import nullcontext

import torch
from ikimono_scan_ml import training


def test_create_grad_scaler_uses_torch_amp_with_device_type(monkeypatch) -> None:
    calls = []

    class FakeGradScaler:
        def __init__(self, device_type: str, *, enabled: bool) -> None:
            calls.append((device_type, enabled))

    monkeypatch.setattr(torch.amp, "GradScaler", FakeGradScaler)

    scaler = training._create_grad_scaler(
        torch.device("cuda"),
        mixed_precision=True,
        precision_dtype="fp16",
    )

    assert isinstance(scaler, FakeGradScaler)
    assert calls == [("cuda", True)]


def test_bf16_mixed_precision_disables_grad_scaler(monkeypatch) -> None:
    calls = []

    class FakeGradScaler:
        def __init__(self, device_type: str, *, enabled: bool) -> None:
            calls.append((device_type, enabled))

    monkeypatch.setattr(torch.amp, "GradScaler", FakeGradScaler)

    training._create_grad_scaler(
        torch.device("cuda"),
        mixed_precision=True,
        precision_dtype="bf16",
    )

    assert calls == [("cuda", False)]


def test_autocast_uses_torch_amp_with_fp16_dtype(monkeypatch) -> None:
    calls = []

    def fake_autocast(*, device_type: str, enabled: bool, dtype: torch.dtype):
        calls.append((device_type, enabled, dtype))
        return nullcontext()

    monkeypatch.setattr(torch.amp, "autocast", fake_autocast)

    with training._autocast_context(torch.device("cuda"), enabled=True, precision_dtype="fp16"):
        pass

    assert calls == [("cuda", True, torch.float16)]


def test_autocast_uses_torch_amp_with_bf16_dtype(monkeypatch) -> None:
    calls = []

    def fake_autocast(*, device_type: str, enabled: bool, dtype: torch.dtype):
        calls.append((device_type, enabled, dtype))
        return nullcontext()

    monkeypatch.setattr(torch.amp, "autocast", fake_autocast)

    with training._autocast_context(torch.device("cuda"), enabled=True, precision_dtype="bf16"):
        pass

    assert calls == [("cuda", True, torch.bfloat16)]


def test_unknown_mixed_precision_dtype_is_rejected() -> None:
    try:
        training._resolve_amp_dtype("tf32")
    except ValueError as error:
        assert "mixed_precision_dtype" in str(error)
    else:
        raise AssertionError("Expected unknown mixed precision dtype to be rejected")
