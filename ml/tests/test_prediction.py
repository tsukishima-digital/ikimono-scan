from ikimono_scan_ml.config import PredictionPolicy
from ikimono_scan_ml.prediction import ClassScore, summarize_prediction


def test_prediction_returns_unknown_when_scores_are_missing() -> None:
    result = summarize_prediction([], PredictionPolicy.from_values())

    assert result.status == "unknown"
    assert result.display_name == "不明"


def test_prediction_returns_unknown_when_confidence_is_low() -> None:
    result = summarize_prediction(
        [
            ClassScore(
                scientific_name="Aromia bungii",
                common_name="クビアカツヤカミキリ",
                confidence=0.4,
            )
        ],
        PredictionPolicy.from_values(confidence_threshold=0.6),
    )

    assert result.status == "unknown"
    assert result.display_name == "不明"


def test_prediction_marks_target_when_confident() -> None:
    result = summarize_prediction(
        [
            ClassScore(
                scientific_name="Aromia bungii",
                common_name="クビアカツヤカミキリ",
                confidence=0.9,
            )
        ],
        PredictionPolicy.from_values(confidence_threshold=0.6),
    )

    assert result.status == "target_likely"
    assert result.display_name == "クビアカツヤカミキリ"


def test_prediction_displays_other_species_when_confident() -> None:
    result = summarize_prediction(
        [
            ClassScore(
                scientific_name="Anoplophora malasiaca",
                common_name="ゴマダラカミキリ",
                confidence=0.85,
            )
        ],
        PredictionPolicy.from_values(confidence_threshold=0.6),
    )

    assert result.status == "other_species_likely"
    assert result.display_name == "ゴマダラカミキリ"
