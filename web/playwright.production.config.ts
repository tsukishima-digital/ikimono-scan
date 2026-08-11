import { defineConfig, devices } from "@playwright/test";

const publicBaseUrl = process.env.E2E_PUBLIC_BASE_URL;
if (!publicBaseUrl) {
  throw new Error(
    "E2E_PUBLIC_BASE_URL is required for production end-to-end tests.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production.spec.ts",
  forbidOnly: true,
  retries: 0,
  reporter: [["github"], ["html", { open: "never" }]],
  timeout: 180_000,
  expect: { timeout: 120_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: publicBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "production-chromium" }],
});
