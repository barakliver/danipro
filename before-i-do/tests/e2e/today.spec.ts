import { expect, test } from "@playwright/test";
import { snapshotContent } from "./support/db";

test("Today: see what to post, copy it, mark it published", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "מה מעלים היום?" })).toBeVisible();

  const card = page.locator("article[aria-labelledby=today-hook]");
  await expect(card).toBeVisible();
  const hook = (await card.locator("#today-hook").innerText()).trim();
  expect(hook.length).toBeGreaterThan(3);

  // copy puts real text on the clipboard
  await card.getByRole("button", { name: /^העתק/ }).click();
  await expect(page.getByText("הועתק")).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.trim().length).toBeGreaterThan(3);

  // "ערוך" opens the editor for the same piece
  const editHref = await card.getByRole("link", { name: "ערוך" }).getAttribute("href");
  const id = editHref!.split("/").pop()!.split("?")[0];
  const restore = await snapshotContent(id);
  try {
    await card.getByRole("group", { name: "סטטוס" }).getByRole("button", { name: "פורסם" }).click();
    await expect(page.getByText("סומן כפורסם")).toBeVisible();
    await page.goto(`/content/${id}`);
    await expect(page.getByText("פורסם").first()).toBeVisible();
  } finally {
    await restore();
  }
});

test("Today: a quick optional Story is offered", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "יש לך עוד 10 דקות?" })).toBeVisible();
});
