import { defineConfig, devices } from "@playwright/test";

/**
 * Responsive layout tests run against the live dashboard.
 * Start it first: `node packages/cli/dist/index.js start`
 */
export default defineConfig({
  testDir: "./playwright",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-320",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 568 } },
    },
    {
      name: "chromium-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "chromium-1200",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 800 } },
    },
  ],
});
