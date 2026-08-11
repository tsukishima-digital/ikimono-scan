import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentPagePaths, contentPageRoutes } from "./content-page-routes";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function classificationResult(commonName: string, id: string) {
  return {
    predictions: [
      {
        classInfo: {
          id,
          commonName,
          scientificName: `Species ${id}`,
        },
        confidence: 0.93,
      },
    ],
    accepted: true,
    executionProvider: "wasm" as const,
  };
}

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("shows How to use before requesting the camera on a first visit", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);

    render(<App />);

    expect(window.location.pathname).toBe("/how-to");
    expect(
      screen.getByRole("heading", {
        name: "How to use",
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

  it("starts with image selection from the corresponding How to use action", () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "写真から始める" }));

    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(
      "complete",
    );
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?mode=photo");
    expect(screen.getByRole("tab", { name: "写真" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("写真を選ぶ")).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
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

  it.each(["Scan", "生き物スキャン ホーム"])(
    "%s explicitly starts the scanner even before onboarding is complete",
    async (controlName) => {
      const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
      installCamera(getUserMedia);
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      window.history.replaceState({}, "", "/how-to");

      render(<App />);
      if (controlName === "Scan") {
        fireEvent.click(
          screen.getByRole("button", { name: "メニューを開く" }),
        );
      }
      fireEvent.click(screen.getByRole("link", { name: controlName }));

      expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(
        "complete",
      );
      expect(window.location.pathname).toBe("/");
      await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
      expect(screen.getByRole("tab", { name: "撮影" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    },
  );

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
    expect(screen.getByRole("link", { name: "How to use" })).toHaveAttribute(
      "href",
      "/how-to#camera",
    );
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Changelog" }));

    expect(window.location.pathname).toBe("/changelog");
    expect(
      screen.getByRole("heading", { name: "Changelog" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/", "Scan"] as const,
    ...contentPageRoutes.flatMap(({ menuLabel, paths }) =>
      paths.map((path) => [path, menuLabel] as const),
    ),
  ])("marks the current page in the site menu at %s", (pathname, label) => {
    installCamera(vi.fn().mockResolvedValue(cameraStream()));
    window.history.replaceState({}, "", pathname);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const link of screen.getAllByRole("link")) {
      if (link.getAttribute("aria-label") === "生き物スキャン ホーム") continue;
      if (link.textContent === label) continue;
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("links the photo tab to its How to use section", () => {
    installCamera(vi.fn().mockResolvedValue(cameraStream()));
    window.history.replaceState({}, "", "/?mode=photo");

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("link", { name: "How to use" })).toHaveAttribute(
      "href",
      "/how-to#photo",
    );
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

  it("invalidates a pending classification when the input method changes", async () => {
    const pending = deferred<ReturnType<typeof classificationResult>>();
    mockedCreateClassifier.mockResolvedValueOnce({
      classify: vi.fn().mockReturnValue(pending.promise),
    });
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const input = await screen.findByLabelText("写真を選ぶ");

    fireEvent.change(input, {
      target: {
        files: [new File(["old"], "old.jpg", { type: "image/jpeg" })],
      },
    });

    expect(await screen.findByText("写真を判定しています")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "撮影" }));

    await act(async () => {
      pending.resolve(classificationResult("古い判定", "old"));
      await pending.promise;
    });

    expect(screen.queryByText("古い判定")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("写真を選ぶ")).toBeInTheDocument();
  });

  it("keeps the newest result when an earlier retry fails later", async () => {
    const first = deferred<ReturnType<typeof classificationResult>>();
    const classify = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(classificationResult("新しい判定", "new"));
    mockedCreateClassifier.mockResolvedValueOnce({ classify });
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);
    const firstInput = await screen.findByLabelText("写真を選ぶ");

    fireEvent.change(firstInput, {
      target: {
        files: [new File(["old"], "old.jpg", { type: "image/jpeg" })],
      },
    });
    expect(await screen.findByText("写真を判定しています")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "選び直す" }));

    fireEvent.change(screen.getByLabelText("写真を選ぶ"), {
      target: {
        files: [new File(["new"], "new.jpg", { type: "image/jpeg" })],
      },
    });
    expect(await screen.findByText("新しい判定")).toBeInTheDocument();

    await act(async () => {
      first.reject(new Error("古い判定の失敗"));
      await first.promise.catch(() => undefined);
    });

    expect(screen.getByText("新しい判定")).toBeInTheDocument();
    expect(screen.queryByText("古い判定の失敗")).not.toBeInTheDocument();
  });

  it("releases camera and preview resources when they leave use", async () => {
    const pending = deferred<ReturnType<typeof classificationResult>>();
    mockedCreateClassifier.mockResolvedValueOnce({
      classify: vi.fn().mockReturnValue(pending.promise),
    });
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    installCamera(getUserMedia);
    render(<App />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("tab", { name: "写真" }));
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("写真を選ぶ"), {
      target: {
        files: [new File(["image"], "beetle.jpg", { type: "image/jpeg" })],
      },
    });
    expect(await screen.findByAltText("判定する写真")).toHaveAttribute(
      "src",
      "blob:preview",
    );
    expect(await screen.findByText("写真を判定しています")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    fireEvent.click(screen.getByRole("link", { name: "About" }));

    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview"),
    );
    expect(window.location.pathname).toBe("/about");

    await act(async () => {
      pending.reject(new Error("離脱後の失敗"));
      await pending.promise.catch(() => undefined);
    });
    expect(
      screen.getByRole("heading", { name: "現在判定できる生き物" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("離脱後の失敗")).not.toBeInTheDocument();
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
    const summaryItems = within(
      screen.getByRole("list", { name: "判定対象の概要" }),
    ).getAllByRole("listitem");
    expect(summaryItems).toHaveLength(2);
    expect(summaryItems[0]).toHaveTextContent(/^現在の分類対象422種$/);
    expect(summaryItems[1]).toHaveTextContent(/^現在の対象グループ甲虫$/);
    expect(
      within(screen.getByRole("list", { name: "判定対象の例" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: /の観察写真/ })).toHaveLength(3);
    expect(
      screen.getAllByRole("link", { name: "iNaturalistで見る" }),
    ).toHaveLength(3);
    expect(screen.getByText("特定外来生物")).toBeInTheDocument();
    expect(screen.getAllByTestId("specimen-designation-slot")).toHaveLength(3);
    expect(
      screen.queryByRole("link", { name: "使い方を見る" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("banner", { name: "サイトヘッダー" }),
    ).toHaveClass("fixed");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("provides camera and photo instructions without an intermediate chooser", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/how-to#photo");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "How to use" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "カメラで撮る" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "写真を選ぶ" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "使い方を選ぶ" }),
    ).not.toBeInTheDocument();
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

  it.each(contentPagePaths)(
    "renders %s through the shared content-page layout",
    (pathname) => {
      installCamera(vi.fn());
      window.history.replaceState({}, "", pathname);

      render(<App />);

      expect(screen.getByTestId("content-page-layout")).toBeInTheDocument();
      expect(screen.getAllByTestId("content-page-frame")).toHaveLength(3);
      expect(screen.getByTestId("page-hero")).toBeInTheDocument();
    },
  );

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
