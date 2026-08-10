import pytest
from ikimono_scan_ml import training
from torch import nn


@pytest.mark.parametrize(
    "architecture",
    [
        "mobilenet_v3_small",
        "mobilenet_v3_large",
        "efficientnet_b0",
        "convnext_tiny",
    ],
)
def test_build_model_supports_classifier_candidates(architecture: str) -> None:
    model = training._build_model(
        architecture=architecture,
        num_classes=7,
        pretrained=False,
    )

    classifier = _last_linear(model)
    assert classifier.out_features == 7


def _last_linear(module: nn.Module) -> nn.Linear:
    for child in reversed(list(module.modules())):
        if isinstance(child, nn.Linear):
            return child
    raise AssertionError("model has no linear classifier")
