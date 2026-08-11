import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { contentPagePaths } from "../src/content-page-routes";

const onboardingKey = "ikimono-scan:onboarding:v1";
const specimenPath = fileURLToPath(
  new URL(
    "../src/assets/specimens/aromia-bungii-712990656.jpg",
    import.meta.url,
  ),
);

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

async function completeOnboarding(page: Page) {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "complete"),
    onboardingKey,
  );
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

test("About keeps image credits out of specimen cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about");

  const names = await page
    .getByTestId("specimen-common-name")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
  expect(new Set(names).size).toBe(1);
  await expect(page.getByTestId("specimen-license")).toHaveCount(0);
  await expect(page.getByRole("note", { name: "写真クレジット" })).toBeVisible();
});

test("specimen examples load as decodable images", async ({ page }) => {
  await page.goto("/about");
  await expectDecodedImages(
    page,
    page.getByRole("img", { name: /の観察写真$/ }),
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

  const actions = await page.getByTestId("how-to-action").evaluateAll(
    (elements) =>
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

test("first-time visitors start the scanner deliberately and keep that choice", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/how-to$/);
  await expect(page.getByRole("heading", { name: "How to use" })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  const startButton = page.getByRole("button", { name: "カメラを開く" });
  await startButton.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("写真を選ぶ")).toBeVisible();
});

test("model download failure leaves the photo flow usable for retry", async ({
  page,
}) => {
  await completeOnboarding(page);
  await page.route("**/models/manifest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 503, body: "temporarily unavailable" });
  });
  await page.goto("/");
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
  await completeOnboarding(page);
  let releaseRequest!: () => void;
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/models/manifest.json", async (route) => {
    await requestReleased;
    await route.fulfill({ status: 503, body: "abandoned request" });
  });
  await page.goto("/");

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
  await completeOnboarding(page);
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
  await page.goto("/");

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
