import { mkdirSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";

/** Logs in once as the E2E user and saves the session for every test. */
export default async function globalSetup(config: FullConfig) {
  const { baseURL, launchOptions } = config.projects[0].use;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("Set E2E_EMAIL and E2E_PASSWORD (see .env.example)");
  mkdirSync("tests/e2e/.auth", { recursive: true });
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(`${baseURL}/login`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }), page.click("button[type=submit]")]);
  await page.context().storageState({ path: "tests/e2e/.auth/state.json" });
  await browser.close();
}
