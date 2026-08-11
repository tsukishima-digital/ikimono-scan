export interface ModelClass {
  id: string;
  scientificName: string;
  commonName?: string;
}

export interface ModelManifest {
  version: string;
  modelUrl: string;
  sha256: string;
  license: string;
  source: string;
  imageSize: number;
  minimumConfidence: number;
  inputName?: string;
  outputName?: string;
  evaluation?: {
    validationImages: number;
    accuracy: number;
    macroF1: number;
  };
  classes: ModelClass[];
}

export interface Classification {
  classInfo: ModelClass;
  confidence: number;
}

export interface ClassificationResult {
  predictions: Classification[];
  accepted: boolean;
  executionProvider: "webgpu" | "wasm";
}

export interface Classifier {
  classify(file: File): Promise<ClassificationResult>;
}
