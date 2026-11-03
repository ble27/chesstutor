import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5174", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
    },
    {
      command:
        "../../.venv/bin/python -m uvicorn tests.browser_fixture_app:app --host 127.0.0.1 --port 8012 --app-dir ../..",
      url: "http://127.0.0.1:8012/api/v1/health/live",
      reuseExistingServer: false,
    },
  ],
});
