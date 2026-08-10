import pytest
import torch
from ikimono_scan_ml import training


def test_cosine_lr_scheduler_is_configurable() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))
    optimizer = torch.optim.AdamW([parameter], lr=0.003)

    scheduler = training._build_lr_scheduler(
        optimizer,
        scheduler_config={"type": "cosine", "min_learning_rate": 0.000001},
        epochs=10,
    )

    assert isinstance(scheduler, torch.optim.lr_scheduler.CosineAnnealingLR)
    assert scheduler.eta_min == pytest.approx(0.000001)


def test_step_lr_scheduler_is_configurable() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))
    optimizer = torch.optim.AdamW([parameter], lr=0.003)

    scheduler = training._build_lr_scheduler(
        optimizer,
        scheduler_config={"type": "step", "step_size": 3, "gamma": 0.2},
        epochs=10,
    )

    assert isinstance(scheduler, torch.optim.lr_scheduler.StepLR)
    assert scheduler.step_size == 3
    assert scheduler.gamma == pytest.approx(0.2)


def test_unknown_lr_scheduler_is_rejected() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))
    optimizer = torch.optim.AdamW([parameter], lr=0.003)

    with pytest.raises(ValueError, match="lr_scheduler.type"):
        training._build_lr_scheduler(
            optimizer,
            scheduler_config={"type": "linear"},
            epochs=10,
        )


def test_adamw_optimizer_is_default() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))

    optimizer = training._build_optimizer(
        [parameter],
        {"learning_rate": 0.001, "weight_decay": 0.01},
    )

    assert isinstance(optimizer, torch.optim.AdamW)
    assert optimizer.param_groups[0]["lr"] == pytest.approx(0.001)
    assert optimizer.param_groups[0]["weight_decay"] == pytest.approx(0.01)


def test_sgd_optimizer_with_momentum_is_configurable() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))

    optimizer = training._build_optimizer(
        [parameter],
        {
            "optimizer": "sgd",
            "learning_rate": 0.03,
            "momentum": 0.9,
            "weight_decay": 0.0001,
        },
    )

    assert isinstance(optimizer, torch.optim.SGD)
    assert optimizer.param_groups[0]["lr"] == pytest.approx(0.03)
    assert optimizer.param_groups[0]["momentum"] == pytest.approx(0.9)


def test_unknown_optimizer_is_rejected() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0]))

    with pytest.raises(ValueError, match="training.optimizer"):
        training._build_optimizer(
            [parameter],
            {"optimizer": "lion", "learning_rate": 0.001, "weight_decay": 0.0},
        )
