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
import { scrollPositionStorageKey } from "./scroll-restoration";
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
    window.history.replaceState({}, "", "/scan");
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
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("opens with a public introduction before requesting the camera", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", {
        name: "見つけた生き物の、名前を調べる",
      }),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "生物を判定する" }));

    expect(window.location.pathname).toBe("/scan");
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  });

  it("starts with image selection from the corresponding How to use action", () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/how-to");

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "写真から始める" }));

    expect(window.location.pathname).toBe("/scan");
    expect(window.location.search).toBe("?mode=photo");
    expect(screen.getByRole("tab", { name: "写真" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("写真を選ぶ")).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("can start scanning when persistent storage is unavailable", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(cameraStream());
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/how-to");
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

    expect(window.location.pathname).toBe("/scan");
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("keeps the site title linked to the public introduction", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/how-to");

    render(<App />);
    fireEvent.click(
      screen.getByRole("link", { name: "生き物スキャン ホーム" }),
    );

    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", { name: "見つけた生き物の、名前を調べる" }),
    ).toBeInTheDocument();
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
    expect(screen.getByLabelText("カメラ映像")).toHaveStyle({
      transform: "scale(1.15)",
    });
    expect(screen.getByText("判定範囲")).toBeInTheDocument();
    expect(screen.getByText("虫全体を中央に収める")).toBeInTheDocument();
  });

  it("orders the Japanese navigation around understanding before action", async () => {
    installCamera(vi.fn().mockResolvedValue(cameraStream()));
    render(<App />);

    const menuButton = screen.getByRole("button", { name: "メニューを開く" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", {
      name: "メインナビゲーション",
    });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((link) => within(link).getByTestId("menu-link-label").textContent),
    ).toEqual([
      "このサイトについて",
      "判定できる生き物",
      "使い方",
      "更新情報",
      "生物を判定する",
    ]);
    expect(screen.getByRole("link", { name: "使い方" })).toHaveAttribute(
      "href",
      "/how-to#photo-guide",
    );
    fireEvent.click(screen.getByRole("link", { name: "更新情報" }));

    expect(window.location.pathname).toBe("/changelog");
    expect(
      screen.getByRole("heading", { name: "Changelog" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/scan", "生物を判定する"] as const,
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
    expect(
      within(screen.getByRole("link", { name: label })).getByTestId(
        "current-page-cursor",
      ),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      if (link.getAttribute("aria-label") === "生き物スキャン ホーム") continue;
      if (within(link).queryByTestId("menu-link-label")?.textContent === label)
        continue;
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("links both input modes to the shared photo guide", () => {
    installCamera(vi.fn().mockResolvedValue(cameraStream()));
    window.history.replaceState({}, "", "/scan?mode=photo");

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("link", { name: "使い方" })).toHaveAttribute(
      "href",
      "/how-to#photo-guide",
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
    expect(screen.getByRole("img", { name: "判定する写真" })).toHaveStyle({
      transform: "scale(1.15)",
    });
    expect(screen.getByText("判定範囲")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("link", { name: "このサイトについて" }));

    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview"),
    );
    expect(window.location.pathname).toBe("/");

    await act(async () => {
      pending.reject(new Error("離脱後の失敗"));
      await pending.promise.catch(() => undefined);
    });
    expect(
      screen.getByRole("heading", { name: "見つけた生き物の、名前を調べる" }),
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

  it("accepts an iPhone HEIC file when the browser omits its MIME type", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);

    fireEvent.change(await screen.findByLabelText("写真を選ぶ"), {
      target: {
        files: [new File(["heic"], "iphone.HEIC")],
      },
    });

    expect(await screen.findByText("クビアカツヤカミキリ")).toBeInTheDocument();
  });

  it("rejects an unsupported image format before loading the model", async () => {
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);

    fireEvent.change(await screen.findByLabelText("写真を選ぶ"), {
      target: {
        files: [new File(["gif"], "animated.gif", { type: "image/gif" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "JPEG、PNG、WebP、HEIC",
    );
    expect(mockedCreateClassifier).not.toHaveBeenCalled();
  });

  it("lets the user choose another photo after browser decoding fails", async () => {
    mockedCreateClassifier.mockResolvedValueOnce({
      classify: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "この写真を読み込めませんでした。JPEG、PNG、WebP、HEICの写真を選んでください。",
          ),
        ),
    });
    installCamera(
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    );
    render(<App />);

    fireEvent.change(await screen.findByLabelText("写真を選ぶ"), {
      target: {
        files: [new File(["broken"], "broken.jpg", { type: "image/jpeg" })],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この写真を読み込めませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "選び直す" }));
    expect(screen.getByLabelText("写真を選ぶ")).toBeInTheDocument();
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

  it("routes product information to the public home page", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "見つけた生き物の、名前を調べる",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "見つけた生き物を写真に撮ると、名前の候補を調べられます。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "写真は端末内で判定" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /写真の判定処理は端末内で完結し、画像データを外部へ送信しません/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /ページを開いている間なら、電波の届かない場所でも判定できます/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "実装をオープンソースで公開" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ソースコードはGitHubで公開しています。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "生物を判定する" }),
    ).toHaveAttribute("href", "/scan");
    expect(
      screen.getByRole("region", { name: "生き物スキャンについて" }),
    ).toHaveTextContent("現在は、日本で観察された甲虫422種に対応");
    expect(screen.getByRole("banner", { name: "サイトヘッダー" })).toHaveClass(
      "fixed",
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("does not treat the retired about path as a page", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/about");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "見つけた生き物の、名前を調べる" }),
    ).not.toBeInTheDocument();
  });

  it("renders supported species and public evaluation values from the model manifest", async () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/supported-species");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            version: "0.1.0",
            modelUrl: "/models/model.onnx",
            sha256: "a".repeat(64),
            license: "CC-BY-NC-4.0",
            source: "/models/v0.1.0.md",
            imageSize: 320,
            minimumConfidence: 0.6,
            evaluation: {
              validationImages: 3188,
              accuracy: 0.7971,
              macroF1: 0.7771,
            },
            classes: [
              {
                id: "48484",
                commonName: "ナミテントウ",
                scientificName: "Harmonia axyridis",
              },
              {
                id: "494519",
                commonName: "クビアカツヤカミキリ",
                scientificName: "Aromia bungii",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "判定できる生き物" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2種", { selector: "strong" })).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "判定できる生き物の一覧" }),
    ).toBeInTheDocument();
    const speciesTable = screen.getByRole("table", {
      name: "判定できる生き物の一覧",
    });
    expect(
      within(speciesTable).getByText("クビアカツヤカミキリ"),
    ).toBeInTheDocument();
    expect(within(speciesTable).getByText("Aromia bungii")).toBeInTheDocument();
    expect(screen.getByText("3,188枚")).toBeInTheDocument();
    expect(screen.getByText("79.7%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "分類の正解率は以下のようになっています。撮影条件などでパフォーマンスは上下することがあります。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "GitHubで詳しく見る" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/tsukishima-digital/ikimono-scan",
    );

    expect(
      within(speciesTable)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0]?.textContent),
    ).toEqual(["クビアカツヤカミキリ", "ナミテントウ"]);

    const credit = screen.getByRole("note", { name: "写真クレジット" });
    expect(
      speciesTable.compareDocumentPosition(credit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "生き物を検索" }), {
      target: { value: "ナミテントウ" },
    });
    expect(
      within(speciesTable).queryByText("クビアカツヤカミキリ"),
    ).not.toBeInTheDocument();
    expect(within(speciesTable).getByText("ナミテントウ")).toBeInTheDocument();
  });

  it("uses one clear example to explain the shared photo guide", () => {
    const getUserMedia = vi.fn();
    installCamera(getUserMedia);
    window.history.replaceState({}, "", "/how-to#photo-guide");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "How to use" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "判定しやすい写真を用意する" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/虫全体が中央に写り/)).toBeInTheDocument();
    expect(
      screen.getByText(/見本の画像を参考にしてください/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/左の見本/)).not.toBeInTheDocument();
    expect(screen.queryByText(/iNaturalist/)).not.toBeInTheDocument();
    expect(screen.queryByText(/学習/)).not.toBeInTheDocument();
    expect(screen.queryByText(/切り出/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "判定しやすい写真の見本",
      }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("list", { name: "判定しやすい写真のポイント" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(4);
    expect(
      screen.getByText(/枠の半分から3分の2ほどを占める大きさ/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("model-crop-example")).toHaveClass(
      "aspect-square",
    );
    expect(screen.getByText("大きさの見本")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "判定しやすい写真を用意する" }),
      ).queryByRole("link"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "カメラを開く" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "写真から始める" }),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("restores the current page position after a mobile browser reload", async () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/how-to");
    window.sessionStorage.setItem(scrollPositionStorageKey("/how-to"), "640");

    render(<App />);

    await waitFor(() =>
      expect(window.scrollTo).toHaveBeenCalledWith({
        behavior: "auto",
        top: 640,
      }),
    );
  });

  it("saves the current page position when the browser goes into the background", () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/how-to");
    const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 480,
    });
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    render(<App />);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(
      window.sessionStorage.getItem(scrollPositionStorageKey("/how-to")),
    ).toBe("480");
    visibilityState.mockRestore();
    if (originalScrollY)
      Object.defineProperty(window, "scrollY", originalScrollY);
  });

  it("keeps the saved position current while the visitor scrolls", async () => {
    installCamera(vi.fn());
    window.history.replaceState({}, "", "/how-to");
    const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 720,
    });

    render(<App />);
    fireEvent.scroll(window);

    await waitFor(() =>
      expect(
        window.sessionStorage.getItem(scrollPositionStorageKey("/how-to")),
      ).toBe("720"),
    );
    if (originalScrollY)
      Object.defineProperty(window, "scrollY", originalScrollY);
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
    expect(screen.getByRole("banner", { name: "サイトヘッダー" })).toHaveClass(
      "fixed",
    );
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
