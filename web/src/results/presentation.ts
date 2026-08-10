import type { Classification } from "../inference/types";

export function formatConfidencePercentage(
  confidence: number,
): string | undefined {
  // Business: Values that still read as 0.0% add noise and must not produce a candidate row.
  const percentage = Number((confidence * 100).toFixed(1));
  return percentage === 0 ? undefined : percentage.toFixed(1);
}

export function visibleAlternativePredictions(
  predictions: Classification[],
): Classification[] {
  return predictions
    .slice(1)
    .filter(
      (prediction) =>
        formatConfidencePercentage(prediction.confidence) !== undefined,
    );
}
