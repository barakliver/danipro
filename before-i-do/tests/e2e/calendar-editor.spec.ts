import { expect, test } from "@playwright/test";
import { snapshotContent } from "./support/db";

test("Calendar: views switch and filters filter", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "לוח תוכן" })).toBeVisible();
  for (const view of ["חודש", "שבוע", "רשימה"]) {
    await page.getByRole("tab", { name: view, exact: true }).click();
    await expect(page.getByRole("tab", { name: view, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await page.getByLabel("פורמט").selectOption({ label: "קרוסלה" });
  const items = page.locator('[aria-roledescription="פריט שאפשר לגרור"]');
  await expect(items.first()).toBeVisible();
  const labels = await items.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) expect(label.startsWith("קרוסלה")).toBe(true);
});

test("Editor: open scheduled content, edit, autosave, survives reload, version history", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("tab", { name: "רשימה", exact: true }).click();
  await page.getByLabel("פורמט").selectOption({ label: "סטורי" });
  const first = page.locator('[aria-roledescription="פריט שאפשר לגרור"]').first();
  const href = await first.getAttribute("href");
  const id = href!.split("/").pop()!;
  const restore = await snapshotContent(id);
  try {
    await first.click();
    await page.waitForURL(`**/content/${id}`);
    const hook = page.getByLabel(/^הוק/);
    await expect(hook).toBeVisible();
    const marker = ` בדיקה ${Date.now() % 10000}`;
    await hook.fill(((await hook.inputValue()) + marker).trim());
    await expect(page.getByText(/^נשמר \d/)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByLabel(/^הוק/)).toHaveValue(new RegExp(marker.trim()));

    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await page.getByRole("menuitem", { name: "היסטוריית גרסאות" }).click();
    await expect(page.getByRole("dialog", { name: "היסטוריית גרסאות" })).toBeVisible();
  } finally {
    await restore();
  }
});
