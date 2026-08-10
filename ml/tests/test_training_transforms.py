import pytest
from ikimono_scan_ml import training
from PIL import Image
from torch import Tensor
from torchvision import transforms


def _types(transform):
    return [type(item) for item in transform.transforms]


def test_train_transforms_keep_existing_defaults() -> None:
    transform = training._train_transforms(224, None)

    types = _types(transform)
    assert transforms.RandomResizedCrop in types
    assert transforms.RandomHorizontalFlip in types
    assert transforms.ColorJitter in types
    assert transforms.RandomVerticalFlip not in types


def test_train_transforms_can_randomly_place_aspect_preserving_resize(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(training.random, "uniform", lambda minimum, _maximum: minimum)
    monkeypatch.setattr(training.random, "randint", lambda _minimum, maximum: maximum)
    transform = training._train_transforms(
        224,
        {"color_jitter": None},
        resize_mode="pad",
    )

    assert training.AspectRatioPadResize in _types(transform)
    assert transforms.RandomResizedCrop not in _types(transform)

    output = transform(_wide_red_image())

    assert _red_bbox_aspect_ratio(output) == pytest.approx(3.0, abs=0.05)
    assert _red_bbox_top_left(output) != (45, 89)


def test_eval_transforms_can_preserve_aspect_ratio_with_padding() -> None:
    transform = training._eval_transforms(224, resize_mode="pad")

    assert training.AspectRatioPadResize in _types(transform)
    assert transforms.CenterCrop not in _types(transform)

    output = transform(_wide_red_image())

    assert _red_bbox_aspect_ratio(output) == pytest.approx(3.0, abs=0.02)


def test_train_transforms_can_center_aspect_preserving_resize(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(training.random, "uniform", lambda minimum, _maximum: minimum)
    transform = training._train_transforms(
        224,
        {"color_jitter": None},
        resize_mode="pad",
        pad_position="center",
    )

    output = transform(_wide_red_image())

    assert _red_bbox_aspect_ratio(output) == pytest.approx(3.0, abs=0.05)
    assert _red_bbox_top_left(output) == (45, 89)


def test_color_jitter_can_be_disabled() -> None:
    transform = training._train_transforms(224, {"color_jitter": None})

    assert transforms.ColorJitter not in _types(transform)


def test_rotation_and_random_erasing_are_configurable() -> None:
    transform = training._train_transforms(
        224,
        {
            "rotation_degrees": 20,
            "random_erasing": {"p": 0.25, "scale": [0.02, 0.12], "ratio": [0.3, 3.3]},
        },
    )

    types = _types(transform)
    assert transforms.RandomRotation in types
    assert transforms.RandomErasing in types


def test_trivial_augment_is_configurable() -> None:
    transform = training._train_transforms(224, {"auto_augment": {"type": "trivial"}})

    assert transforms.TrivialAugmentWide in _types(transform)


def test_randaugment_is_configurable() -> None:
    transform = training._train_transforms(
        224,
        {"auto_augment": {"type": "randaugment", "num_ops": 2, "magnitude": 7}},
    )

    assert transforms.RandAugment in _types(transform)


def test_vertical_flip_is_configurable() -> None:
    transform = training._train_transforms(224, {"vertical_flip": True})

    assert transforms.RandomVerticalFlip in _types(transform)


def _wide_red_image() -> Image.Image:
    image = Image.new("RGB", (300, 100), (0, 0, 0))
    for x in range(300):
        for y in range(100):
            image.putpixel((x, y), (255, 0, 0))
    return image


def _red_bbox_aspect_ratio(tensor: Tensor) -> float:
    red = tensor[0] > 0.5
    ys, xs = red.nonzero(as_tuple=True)
    width = int(xs.max() - xs.min() + 1)
    height = int(ys.max() - ys.min() + 1)
    return round(width / height, 2)


def _red_bbox_top_left(tensor: Tensor) -> tuple[int, int]:
    red = tensor[0] > 0.5
    ys, xs = red.nonzero(as_tuple=True)
    return (int(xs.min()), int(ys.min()))
