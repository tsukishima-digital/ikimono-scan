import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const onboardingKey = "ikimono-scan:onboarding:v1";
const specimenPath = fileURLToPath(
  new URL(
    "../src/assets/specimens/aromia-bungii-712990656.jpg",
    import.meta.url,
  ),
);

async function preparePhotoInput(page: Page) {
  await page.goto("/");
  const photoTab = page.getByRole("tab", { name: "写真" });
  if ((await photoTab.getAttribute("aria-selected")) !== "true") {
    await photoTab.click();
  }
  return page.getByLabel("写真を選ぶ");
}

test("production downloads, verifies, caches, and runs the real model", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "complete"),
    onboardingKey,
  );
  let modelDownloads = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".onnx")) modelDownloads += 1;
  });

  const firstInput = await preparePhotoInput(page);
  await firstInput.setInputFiles(specimenPath);
  await expect(
    page.getByRole("heading", { name: "クビアカツヤカミキリ" }),
  ).toBeVisible();
  expect(modelDownloads).toBe(1);

  const secondInput = await preparePhotoInput(page);
  await secondInput.setInputFiles(specimenPath);
  await expect(
    page.getByRole("heading", { name: "クビアカツヤカミキリ" }),
  ).toBeVisible();
  expect(modelDownloads).toBe(1);
});
