from ikimono_scan_ml import training
from torch import nn


def test_build_criterion_defaults_to_no_label_smoothing() -> None:
    criterion = training._build_criterion({})

    assert isinstance(criterion, nn.CrossEntropyLoss)
    assert criterion.label_smoothing == 0.0


def test_build_criterion_uses_configured_label_smoothing() -> None:
    criterion = training._build_criterion({"label_smoothing": 0.05})

    assert isinstance(criterion, nn.CrossEntropyLoss)
    assert criterion.label_smoothing == 0.05
