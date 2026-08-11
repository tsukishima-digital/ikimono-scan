import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contentPagePaths } from "../src/content-page-routes";

const specimenPath = fileURLToPath(
  new URL(
    "../src/assets/specimens/aromia-bungii-712990656.jpg",
    import.meta.url,
  ),
);
const heicFixture = Buffer.from(
  readFileSync(
    fileURLToPath(new URL("./fixtures/iphone.heic.base64", import.meta.url)),
    "utf8",
  ).trim(),
  "base64",
);

async function selectPatternImage(
  page: Page,
  type: "image/jpeg" | "image/png" | "image/webp",
  layout: "landscape" | "portrait",
  exifOrientation?: 6,
) {
  await page.getByLabel("前処理する写真").evaluate(
    async (element, options) => {
      const input = element as HTMLInputElement;
      const canvas = document.createElement("canvas");
      canvas.width = options.layout === "landscape" ? 120 : 80;
      canvas.height = options.layout === "landscape" ? 80 : 120;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas is unavailable");

      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#0000ff";
      if (options.layout === "landscape") {
        context.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
      } else {
        context.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
      }

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("image encoding failed")),
          options.type,
          0.95,
        ),
      );
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (options.exifOrientation === 6) {
        const exif = new Uint8Array([
          0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49,
          0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01,
          0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00,
        ]);
        const oriented = new Uint8Array(bytes.length + exif.length);
        oriented.set(bytes.subarray(0, 2));
        oriented.set(exif, 2);
        oriented.set(bytes.subarray(2), 2 + exif.length);
        bytes = oriented;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([bytes], `pattern.${options.type.split("/")[1]}`, {
          type: options.type,
        }),
      );
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { exifOrientation, layout, type },
  );
}

async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
    });
  });
}

async function keepCameraPending(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => new Promise<MediaStream>(() => undefined),
      },
    });
  });
}
async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Implementation: Visual color stays with the stacked UI work; this owns structural a11y.
    .disableRules(["color-contrast"])
    .analyze();
  expect(result.violations).toEqual([]);
}

async function contentFrameRects(page: Page) {
  return page.getByTestId("content-page-frame").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }),
  );
}

async function expectDecodedImages(page: Page, images: Locator) {
  const count = await images.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();

    const source = await image.getAttribute("src");
    expect(source).toBeTruthy();
    const response = await page.request.get(source!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^image\//);

    await expect
      .poll(() =>
        image.evaluate(
          (element: HTMLImageElement) =>
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0,
        ),
      )
      .toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await denyCamera(page);
});

test("search discovery files list only public content pages", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain(
    "Sitemap: https://ikimono-scan.app/sitemap.xml",
  );

  const sitemap = await request.get("/sitemap.xml");
  const sitemapText = await sitemap.text();
  expect(sitemap.ok()).toBe(true);
  expect(sitemapText).toContain("https://ikimono-scan.app/supported-species");
  expect(sitemapText).not.toContain("https://ikimono-scan.app/scan");
  expect(sitemapText).not.toContain("https://ikimono-scan.app/about");
});

test("scanner input modes stay inside the viewport on every screen size", async ({
  page,
}) => {
  await keepCameraPending(page);

  for (const viewport of [
    { width: 390, height: 664 },
    { width: 820, height: 1180 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);

    for (const search of ["", "?mode=photo"]) {
      await page.goto(`/scan${search}`);
      await expect(page.getByLabel("生き物を撮影して判定")).toBeVisible();
      await expect(
        page.getByRole("tab", { name: search ? "写真" : "撮影" }),
      ).toHaveAttribute("aria-selected", "true");

      const viewportState = await page.evaluate(() => {
        const scrollingElement = document.scrollingElement!;
        return {
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          documentBackground: getComputedStyle(document.documentElement)
            .backgroundColor,
          innerHeight: window.innerHeight,
          scrollHeight: scrollingElement.scrollHeight,
        };
      });

      expect(viewportState.scrollHeight).toBe(viewportState.innerHeight);
      expect(viewportState.bodyBackground).toBe("rgb(9, 16, 12)");
      expect(viewportState.documentBackground).toBe("rgb(9, 16, 12)");

      await page.evaluate(() => window.scrollTo(0, 100));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
  }
});

for (const pathname of contentPagePaths) {
  test(`${pathname} obeys the shared content-page layout`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pathname);

    await expect(page.getByTestId("content-page-layout")).toBeVisible();
    const desktopRects = await contentFrameRects(page);
    expect(desktopRects).toHaveLength(3);
    expect(new Set(desktopRects.map(({ left }) => left)).size).toBe(1);
    expect(new Set(desktopRects.map(({ right }) => right)).size).toBe(1);
    expect(desktopRects[0]?.width).toBe(1040);

    await page.setViewportSize({ width: 320, height: 720 });
    const mobileRects = await contentFrameRects(page);
    expect(new Set(mobileRects.map(({ left }) => left)).size).toBe(1);
    expect(new Set(mobileRects.map(({ right }) => right)).size).toBe(1);
    expect(mobileRects[0]?.width).toBe(284);
    expect(
      await page.locator("body").evaluate((body) => body.scrollWidth),
    ).toBe(320);
  });
}

test("menu order and cursor make the current page unambiguous", async ({
  page,
}) => {
  await page.goto("/supported-species");
  await page.getByRole("button", { name: "メニューを開く" }).click();

  const menu = page.getByRole("navigation", { name: "メインナビゲーション" });
  await expect(menu.getByTestId("menu-link-label")).toHaveText([
    "このサイトについて",
    "判定できる生き物",
    "使い方",
    "更新情報",
    "生物を判定する",
  ]);

  const current = menu.getByRole("link", { name: "判定できる生き物" });
  const other = menu.getByRole("link", { name: "使い方" });
  await expect(current).toHaveAttribute("aria-current", "page");
  expect(
    await current
      .getByTestId("current-page-cursor")
      .evaluate((element) => getComputedStyle(element).borderLeftWidth),
  ).toBe("8px");

  const presentation = await Promise.all(
    [current, other].map((link) =>
      link.evaluate((element) => {
        const label = element.querySelector<HTMLElement>(
          '[data-testid="menu-link-label"]',
        )!;
        return {
          backgroundColor: getComputedStyle(element).backgroundColor,
          labelLeft: label.getBoundingClientRect().left,
        };
      }),
    ),
  );
  expect(presentation[0]?.backgroundColor).not.toBe(
    presentation[1]?.backgroundColor,
  );
  expect(presentation[0]!.labelLeft).toBeGreaterThan(
    presentation[1]!.labelLeft,
  );
});

test("Supported species is a browsable photo gallery with credits at the bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/supported-species");

  const gallery = page.getByRole("list", {
    name: "判定できる生き物の一覧",
  });
  const cards = gallery.getByRole("listitem");
  await expect(cards).toHaveCount(24);
  await expect(page.getByRole("button", { name: "さらに表示" })).toBeVisible();
  await expect(page.getByText(/次の24/)).toHaveCount(0);

  const firstRow = await cards.evaluateAll((elements) =>
    elements.slice(0, 4).map((element) => element.getBoundingClientRect().top),
  );
  expect(new Set(firstRow).size).toBe(1);

  await cards.first().getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectDecodedImages(page, dialog.getByRole("img"));
  await expect(dialog.getByRole("link", { name: /CC/ })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();

  const credit = page.getByRole("note", { name: "写真クレジット" });
  await expect(credit).toBeVisible();
  expect(
    await gallery.evaluate(
      (list, creditElement) =>
        Boolean(
          list.compareDocumentPosition(creditElement) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      await credit.elementHandle(),
    ),
  ).toBe(true);
});

test("Supported species uses two compact card columns on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/supported-species");

  const cards = page
    .getByRole("list", { name: "判定できる生き物の一覧" })
    .getByRole("listitem");
  await expect(cards.first()).toBeVisible();
  const rects = await cards.evaluateAll((elements) =>
    elements.slice(0, 3).map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width };
    }),
  );

  expect(rects[0]?.top).toBe(rects[1]?.top);
  expect(rects[0]?.width).toBe(rects[1]?.width);
  expect(rects[0]!.left).toBeLessThan(rects[1]!.left);
  expect(rects[2]!.top).toBeGreaterThan(rects[0]!.top);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("Supported species search reveals and moves to an unloaded card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/supported-species");

  await page
    .getByRole("combobox", { name: "生き物を検索" })
    .fill("ヨナグニゴマフカミキリ");
  await page
    .getByRole("button", { name: "ヨナグニゴマフカミキリを表示" })
    .click();

  const target = page.locator("#species-1008176");
  await expect(target).toHaveAttribute("aria-current", "true");
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      }),
    )
    .toBe(true);
  expect(
    await page
      .getByRole("list", { name: "判定できる生き物の一覧" })
      .getByRole("listitem")
      .count(),
  ).toBeGreaterThan(24);
});

test("Supported species search stays below the header only while browsing cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/supported-species");

  const search = page.getByRole("combobox", { name: "生き物を検索" });
  const cards = page
    .getByRole("list", { name: "判定できる生き物の一覧" })
    .getByRole("listitem");
  await expect(search).toBeVisible();

  await cards.nth(16).scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      search.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(68);
  await expect
    .poll(() =>
      search.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(90);

  const credits = page.getByRole("note", { name: "写真クレジット" });
  await credits.getByText("写真クレジット", { exact: true }).click();
  await credits.getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      search.evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(68);
});

test("specimen examples load as decodable images", async ({ page }) => {
  await page.goto("/supported-species");
  await expectDecodedImages(
    page,
    page.getByRole("img", { name: /の観察写真$/ }),
  );
  await expectDecodedImages(
    page,
    page
      .getByRole("list", { name: "判定できる生き物の一覧" })
      .getByRole("img")
      .first(),
  );

  await page.goto("/how-to");
  await expectDecodedImages(
    page,
    page.getByRole("img", { name: "判定しやすい写真の見本" }),
  );
});

test("How to use guide and actions fit the minimum viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/how-to");

  const guideLayout = await page.evaluate(() => ({
    exampleHeight: document.querySelector<HTMLElement>(
      '[data-testid="model-crop-example"]',
    )?.clientHeight,
    exampleWidth: document.querySelector<HTMLElement>(
      '[data-testid="model-crop-example"]',
    )?.clientWidth,
    imageTransform: getComputedStyle(
      document.querySelector<HTMLElement>("#photo-guide img")!,
    ).transform,
    pageWidth: document.documentElement.scrollWidth,
    tipWidths: Array.from(
      document.querySelectorAll<HTMLElement>(
        '[aria-label="判定しやすい写真のポイント"] li',
      ),
    ).map((element) => element.clientWidth),
    viewportWidth: window.innerWidth,
  }));

  expect(guideLayout.exampleWidth).toBe(284);
  expect(guideLayout.exampleHeight).toBe(284);
  expect(guideLayout.imageTransform).toBe("matrix(1.15, 0, 0, 1.15, 0, 0)");
  expect(guideLayout.tipWidths).toEqual([284, 284, 284, 284]);
  expect(guideLayout.pageWidth).toBe(guideLayout.viewportWidth);

  const actions = await page
    .getByTestId("how-to-action")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
    );

  expect(actions).toHaveLength(2);
  for (const action of actions) {
    expect(action.clientHeight).toBe(56);
    expect(action.clientWidth).toBe(284);
    expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth);
    expect(action.whiteSpace).toBe("nowrap");
  }
});

test("How to use example and tips share their desktop baseline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/how-to");

  const layout = await page.evaluate(() => {
    const example = document
      .querySelector<HTMLElement>('[data-testid="photo-guide-example"]')!
      .getBoundingClientRect();
    const tips = document
      .querySelector<HTMLElement>('[data-testid="photo-guide-tips"]')!
      .getBoundingClientRect();
    return {
      exampleTop: example.top,
      exampleBottom: example.bottom,
      tipsTop: tips.top,
      tipsBottom: tips.bottom,
    };
  });

  expect(layout.exampleTop).toBe(layout.tipsTop);
  expect(layout.exampleBottom).toBe(layout.tipsBottom);
});

test("JPEG, PNG, and WebP keep portrait and landscape orientation while resizing", async ({
  page,
}) => {
  await page.goto("/__dev/preprocess");

  for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
    await test.step(`${type} landscape`, async () => {
      await selectPatternImage(page, type, "landscape");
      await expect(page.getByLabel("前処理結果")).toHaveText(
        "red,blue,red,blue",
      );
    });
    await test.step(`${type} portrait`, async () => {
      await selectPatternImage(page, type, "portrait");
      await expect(page.getByLabel("前処理結果")).toHaveText(
        "red,red,blue,blue",
      );
    });
  }
});

test("EXIF Orientation is applied before center cropping", async ({ page }) => {
  await page.goto("/__dev/preprocess");

  await selectPatternImage(page, "image/jpeg", "landscape", 6);

  await expect(page.getByLabel("前処理結果")).toHaveText("red,red,blue,blue");
});

test("Safari can preprocess an iPhone HEIC photo", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "webkit" || process.platform !== "darwin",
    "HEIC requires Safari's Apple-platform image decoder",
  );
  await page.goto("/__dev/preprocess");

  await page.getByLabel("前処理する写真").setInputFiles({
    name: "iphone.heic",
    mimeType: "image/heic",
    buffer: heicFixture,
  });

  await expect(page.getByText("処理できました")).toBeVisible();
});

test("visitors start the scanner deliberately from the public introduction", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /見つけた生き物の、\s*名前を調べる/,
    }),
  ).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  const startButton = page.getByRole("link", { name: "生物を判定する" });
  await startButton.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();
});

test("model download failure leaves the photo flow usable for retry", async ({
  page,
}) => {
  await page.route("**/models/manifest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 503, body: "temporarily unavailable" });
  });
  await page.goto("/scan");
  const input = page.getByLabel("写真を選ぶ");

  await input.setInputFiles(specimenPath);

  await expect(page.getByText("判定モデルを準備しています")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "判定モデルを読み込めませんでした",
  );
  await page.getByRole("button", { name: "選び直す" }).click();
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();
});

test("resetting during model loading ignores the abandoned request", async ({
  page,
}) => {
  let releaseRequest!: () => void;
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/models/manifest.json", async (route) => {
    await requestReleased;
    await route.fulfill({ status: 503, body: "abandoned request" });
  });
  await page.goto("/scan");

  await page.getByLabel("写真を選ぶ").setInputFiles(specimenPath);
  await expect(page.getByText("判定モデルを準備しています")).toBeVisible();
  await page.getByRole("button", { name: "選び直す" }).click();
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();

  const abandonedResponse = page.waitForResponse((response) =>
    response.url().endsWith("/models/manifest.json"),
  );
  releaseRequest();
  await abandonedResponse;
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("判定モデルを読み込めませんでした")).toHaveCount(
    0,
  );
});

test("a model integrity failure is explicit and recoverable", async ({
  page,
}) => {
  await page.route("**/models/manifest.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version: "e2e",
        modelUrl: "/models/e2e.onnx",
        sha256: "0".repeat(64),
        license: "E2E-ONLY",
        source: "local test fixture",
        imageSize: 320,
        minimumConfidence: 0.6,
        classes: [
          {
            id: "494519",
            commonName: "クビアカツヤカミキリ",
            scientificName: "Aromia bungii",
          },
        ],
      }),
    });
  });
  await page.route("**/models/e2e.onnx", (route) =>
    route.fulfill({ body: "not an ONNX model" }),
  );
  await page.goto("/scan");

  await page.getByLabel("写真を選ぶ").setInputFiles(specimenPath);

  await expect(page.getByRole("alert")).toContainText(
    "判定モデルの整合性を確認できませんでした",
  );
  await page.getByRole("button", { name: "選び直す" }).click();
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();
});

test("the completed target result remains accessible in the production build", async ({
  page,
}) => {
  await page.goto("/__dev/result?case=target");

  await expect(
    page.getByRole("heading", { name: "クビアカツヤカミキリ" }),
  ).toBeVisible();
  await expect(page.getByText("95.4")).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
});
