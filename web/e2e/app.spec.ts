import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const onboardingKey = "ikimono-scan:onboarding:v1";
const specimenPath = fileURLToPath(
  new URL("../public/specimens/aromia-bungii-712990656.jpg", import.meta.url),
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
          0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
          0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
          0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
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

test.beforeEach(async ({ page }) => {
  await denyCamera(page);
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

  await expect(page.getByLabel("前処理結果")).toHaveText(
    "red,red,blue,blue",
  );
});

test("Safari can preprocess an iPhone HEIC photo", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "webkit", "HEIC is a Safari compatibility contract");
  await page.goto("/__dev/preprocess");

  await page.getByLabel("前処理する写真").setInputFiles({
    name: "iphone.heic",
    mimeType: "image/heic",
    buffer: heicFixture,
  });

  await expect(page.getByText("処理できました")).toBeVisible();
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
