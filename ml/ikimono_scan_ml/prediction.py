from __future__ import annotations

from dataclasses import dataclass

from ikimono_scan_ml.config import PredictionPolicy


@dataclass(frozen=True)
class ClassScore:
    scientific_name: str
    common_name: str | None
    confidence: float


@dataclass(frozen=True)
class PredictionResult:
    status: str
    top_prediction: ClassScore | None
    display_name: str


def summarize_prediction(scores: list[ClassScore], policy: PredictionPolicy) -> PredictionResult:
    if not scores:
        return PredictionResult(status="unknown", top_prediction=None, display_name="不明")

    top = max(scores, key=lambda score: score.confidence)
    if top.confidence < policy.confidence_threshold:
        return PredictionResult(status="unknown", top_prediction=top, display_name="不明")

    display_name = top.common_name or top.scientific_name
    if top.scientific_name == policy.target_scientific_name:
        return PredictionResult(
            status="target_likely",
            top_prediction=top,
            display_name=display_name,
        )

    return PredictionResult(
        status="other_species_likely",
        top_prediction=top,
        display_name=display_name,
    )
