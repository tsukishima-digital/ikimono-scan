import { describe, expect, it } from "vitest";

import type { Classification } from "../inference/types";
import {
  formatConfidencePercentage,
  visibleAlternativePredictions,
} from "./presentation";

const predictions: Classification[] = [
  {
    classInfo: { id: "1", scientificName: "Species alpha" },
    confidence: 0.95123,
  },
  {
    classInfo: { id: "2", scientificName: "Species beta" },
    confidence: 0.0006,
  },
  {
    classInfo: { id: "3", scientificName: "Species gamma" },
    confidence: 0.0004,
  },
];

describe("formatConfidencePercentage", () => {
  it("uses one decimal place", () => {
    expect(formatConfidencePercentage(0.95123)).toBe("95.1");
    expect(formatConfidencePercentage(0.0006)).toBe("0.1");
  });

  it("omits a value that rounds to zero", () => {
    expect(formatConfidencePercentage(0.0004)).toBeUndefined();
  });
});

describe("visibleAlternativePredictions", () => {
  it("keeps only alternatives with a visible percentage", () => {
    expect(
      visibleAlternativePredictions(predictions).map(
        (prediction) => prediction.classInfo.id,
      ),
    ).toEqual(["2"]);
  });

  it("returns an empty list when every alternative rounds to zero", () => {
    expect(
      visibleAlternativePredictions([predictions[0], predictions[2]]),
    ).toEqual([]);
  });
});
