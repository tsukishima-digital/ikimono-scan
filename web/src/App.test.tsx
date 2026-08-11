import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClassifier } from "./inference/classifier";
import { ONBOARDING_STORAGE_KEY } from "./onboarding";
import App from "./App";

vi.mock("./inference/classifier", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./inference/classifier")>();
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
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    vi.stubGlobal("scrollTo", vi.fn());
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
        accepted: true,
        executionProvider: "wasm",
      }),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("shows About before requesting the camera on a first visit", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);

    render(<App />);

    expect(window.location.pathname).toBe("/about");
    expect(
      screen.getByRole("heading", {
        name: "生き物スキャンは、生物の写真を分類できます。",
      }),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "カメラを開く" }));

    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(
      "complete",
    );
    expect(window.location.pathname).toBe("/");
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  });

  it("can start the current session when persistent storage is unavailable", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "カメラを開く" }));

    expect(window.location.pathname).toBe("/");
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    getItem.mockRestore();
    setItem.mockRestore();
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

  it("opens the header menu and routes to the English-labeled pages", async () => {
    installCamera(vi.fn().mockResolvedValue(cameraStream()));
    render(<App />);

    const menuButton = screen.getByRole("button", { name: "メニューを開く" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Changelog" }));

    expect(window.location.pathname).toBe("/changelog");
    expect(
      screen.getByRole("heading", { name: "Changelog" }),
    ).toBeInTheDocument();
  });

  it("switches to image selection when camera permission is denied", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );

    render(<App />);

    expect(
      await screen.findByText(
        "カメラを利用できないため、写真から選んでください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "写真" })).toHaveAttribute(
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
    expect(
      screen.getByRole("button", { name: "選び直す" }),
    ).toBeInTheDocument();
  });

  it("rejects a non-image file", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const input = await screen.findByLabelText("写真を選ぶ");

    fireEvent.change(input, {
      target: {
        files: [new File(["text"], "note.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "画像ファイルを選んでください",
    );
    expect(mockedCreateClassifier).not.toHaveBeenCalled();
  });

  it("does not name a beetle when the closed-set result is uncertain", async () => {
    mockedCreateClassifier.mockResolvedValueOnce({
      classify: vi.fn().mockResolvedValue({
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
        accepted: false,
        executionProvider: "wasm",
      }),
    });
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const input = await screen.findByLabelText("写真を選ぶ");

    fireEvent.change(input, {
      target: {
        files: [new File(["image"], "person.jpg", { type: "image/jpeg" })],
      },
    });

    expect(
      await screen.findByRole("heading", {
        name: "甲虫を判定できませんでした",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("ガムシ")).not.toBeInTheDocument();
  });

  it("routes product and supported-species information to about", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/about");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "現在判定できる生き物" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "生き物スキャンは、生物の写真を分類できます。",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("422種", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "判定対象の概要" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("list", { name: "判定対象の例" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: /の観察写真/ })).toHaveLength(3);
    expect(
      screen.getAllByRole("link", { name: "iNaturalistで見る" }),
    ).toHaveLength(3);
    expect(
      screen.getByRole("banner", { name: "サイトヘッダー" }),
    ).toHaveClass("fixed");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("provides a dedicated changelog page", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/changelog");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Changelog" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "甲虫分類機能の実装" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/判定モデル読込後のオフライン判定/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("banner", { name: "サイトヘッダー" }),
    ).toHaveClass("fixed");
  });

  it("renders a development result fixture without camera or model access", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/__dev/result?case=target");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "クビアカツヤカミキリ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("95.4")).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(mockedCreateClassifier).not.toHaveBeenCalled();
  });

  it("renders the uncertain result fixture", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/__dev/result?case=uncertain");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "甲虫を判定できませんでした" }),
    ).toBeInTheDocument();
  });
});
