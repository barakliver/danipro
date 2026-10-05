import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// local secrets (E2E_EMAIL / E2E_PASSWORD, Supabase URL) stay in .env.local
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// sandboxed CI/agents route traffic through a proxy; localhost must bypass it
const proxyArgs = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, "--proxy-bypass-list=localhost;127.0.0.1"] : [];

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  use: {
    baseURL,
    storageState: "tests/e2e/.auth/state.json",
    locale: "he-IL",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    launchOptions: { args: proxyArgs, executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
