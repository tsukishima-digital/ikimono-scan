import { SiteHeader } from "../components/SiteHeader";
import type { ClassificationResult } from "../inference/types";
import { ResultSheet } from "./ScannerPage";

const fixtureResults: Record<string, ClassificationResult> = {
  target: {
    accepted: true,
    executionProvider: "wasm",
    predictions: [
      {
        classInfo: {
          id: "494519",
          commonName: "クビアカツヤカミキリ",
          scientificName: "Aromia bungii",
        },
        confidence: 0.954,
      },
      {
        classInfo: {
          id: "270209",
          commonName: "ガムシ",
          scientificName: "Hydrophilus acuminatus",
        },
        confidence: 0.026,
      },
    ],
  },
  uncertain: {
    accepted: false,
    executionProvider: "wasm",
    predictions: [
      {
        classInfo: {
          id: "270209",
          commonName: "ガムシ",
          scientificName: "Hydrophilus acuminatus",
        },
        confidence: 0.49,
      },
    ],
  },
  "no-alternatives": {
    accepted: true,
    executionProvider: "wasm",
    predictions: [
      {
        classInfo: {
          id: "270209",
          commonName: "ガムシ",
          scientificName: "Hydrophilus acuminatus",
        },
        confidence: 0.876,
      },
      {
        classInfo: {
          id: "494519",
          commonName: "クビアカツヤカミキリ",
          scientificName: "Aromia bungii",
        },
        confidence: 0.0004,
      },
    ],
  },
  "long-name": {
    accepted: true,
    executionProvider: "wasm",
    predictions: [
      {
        classInfo: {
          id: "fixture-long-name",
          commonName: "オオキバウスバカミキリモドキ",
          scientificName: "Macrodontia cervicornis",
        },
        confidence: 0.731,
      },
    ],
  },
};

export function ResultFixturePage() {
  const fixtureName =
    new URLSearchParams(window.location.search).get("case") ?? "target";
  const result = fixtureResults[fixtureName] ?? fixtureResults.target;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#14261b] text-white">
      <SiteHeader overlay />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,#7f9b6c_0%,transparent_33%),radial-gradient(circle_at_75%_60%,#354f3b_0%,transparent_38%),linear-gradient(145deg,#9baa83_0%,#263b2d_48%,#0c1710_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/18%),transparent_30%),linear-gradient(to_top,rgb(0_0_0/44%),transparent_38%)]" />
      <ResultSheet
        phase="complete"
        result={result}
        resetLabel="選び直す"
        onReset={() => undefined}
      />
    </main>
  );
}
