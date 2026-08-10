import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClassifier } from "./inference/classifier";
import App from "./App";

vi.mock("./inference/classifier", async (importOriginal) => {
  const original = await importOriginal<typeof import("./inference/classifier")>();
  return {
    ...original,
    createClassifier: vi.fn(),
  };
});

const mockedCreateClassifier = vi.mocked(createClassifier);

function installCamera(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function cameraStream() {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mockedCreateClassifier.mockReset();
    mockedCreateClassifier.mockResolvedValue({
      classify: vi.fn().mockResolvedValue({
        predictions: [
          {
            classInfo: {
              id: "494519",
              commonName: "クビアカツヤカミキリ",
              scientificName: "Aromia bungii",
            },
            confidence: 0.93,
          },
        ],
        executionProvider: "wasm",
      }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("requests the rear camera when the scanner opens", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);

    render(<App />);

    await waitFor(() =>
      expect(getUserMedia).toHaveBeenCalledWith({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      }),
    );
    expect(screen.getByRole("tab", { name: "撮影" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("カメラ映像")).toBeInTheDocument();
  });

  it("switches to image selection when camera permission is denied", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );

    render(<App />);

    expect(
      await screen.findByText("カメラを利用できないため、写真から選んでください。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "写真から" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("写真を選ぶ")).toBeInTheDocument();
  });

  it("does not prepare the model until an image is selected", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const input = await screen.findByLabelText("写真を選ぶ");

    expect(mockedCreateClassifier).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: {
        files: [new File(["image"], "beetle.jpg", { type: "image/jpeg" })],
      },
    });

    await waitFor(() => expect(mockedCreateClassifier).toHaveBeenCalledOnce());
    expect(await screen.findByText("判定結果")).toBeInTheDocument();
    expect(screen.getByText("クビアカツヤカミキリ")).toBeInTheDocument();
  });

  it("rejects a non-image file", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const input = await screen.findByLabelText("写真を選ぶ");

    fireEvent.change(input, {
      target: { files: [new File(["text"], "note.txt", { type: "text/plain" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "画像ファイルを選んでください",
    );
    expect(mockedCreateClassifier).not.toHaveBeenCalled();
  });

  it("routes product and supported-species information to about", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/about");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "現在判定できる生き物" }),
    ).toBeInTheDocument();
    expect(screen.getByText("422種", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/写真は外部へ送信しません/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("provides a dedicated update history page", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/updates");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "更新履歴" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });
});
