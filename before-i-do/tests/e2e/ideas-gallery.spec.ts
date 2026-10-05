import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { db } from "./support/db";

test("Ideas: save a thought fast, filter by tag, open it into content", async ({ page }) => {
  const text = `אמא שלו שאלה אם אפשר להוסיף עוד שולחן ${Date.now() % 100000}`;
  const sb = await db();
  try {
    await page.goto("/ideas");
    await page.getByPlaceholder("זרקי פה משהו שקרה, משפט ששמעת או רעיון").fill(text);
    await page.getByRole("group", { name: "תגיות" }).getByRole("button", { name: "הורים", exact: true }).click();
    await page.getByRole("button", { name: "שמירה" }).click();
    const card = page.getByRole("listitem").filter({ hasText: text });
    await expect(card.getByRole("button", { name: "פתח לתוכן" })).toBeVisible();

    await page.getByLabel("סינון לפי תגית").selectOption("כסף");
    await expect(card).toHaveCount(0);
    await page.getByLabel("סינון לפי תגית").selectOption("הורים");
    await expect(card).toHaveCount(1);

    await card.getByRole("button", { name: "פתח לתוכן" }).click();
    const sheet = page.getByRole("dialog", { name: "פתח לתוכן" });
    await expect(sheet.getByText("מתאים")).toBeVisible();
    await sheet.getByRole("button", { name: "טיוטה ריקה" }).first().click();
    await page.waitForURL("**/content/**");
    await expect(page.getByLabel(/^הוק/)).toHaveValue(text);
  } finally {
    const { data: ideas } = await sb.from("ideas").select("id").eq("body", text);
    const ids = (ideas ?? []).map((i) => i.id);
    if (ids.length) {
      await sb.from("content_items").update({ deleted_at: new Date().toISOString() }).in("idea_id", ids);
      await sb.from("ideas").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    }
  }
});

test("Gallery: bulk upload with a tag, then filter by smart collection", async ({ page }, testInfo) => {
  // a stalled upload is retried once after its time budget, so allow for that
  test.setTimeout(180_000);
  const stamp = Date.now() % 100000;
  const files = await Promise.all(
    ["#c9b8a3", "#7f8fa6"].map(async (color, i) => {
      const path = testInfo.outputPath(`e2e-${stamp}-${i}.jpg`);
      await sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).jpeg().toFile(path);
      return path;
    }),
  );
  const sb = await db();
  try {
    await page.goto("/gallery");
    await page.setInputFiles('input[aria-label="העלאת תמונות וסרטונים"]', files);
    const sheet = page.getByRole("dialog", { name: "העלאת 2 קבצים" });
    await sheet.getByRole("group", { name: "תגיות לכל ההעלאה" }).getByRole("button", { name: "ברק", exact: true }).click();
    await sheet.getByRole("button", { name: "להעלות" }).click();
    await expect(page.getByText("2 עלו לגלריה")).toBeVisible({ timeout: 120_000 });

    await page.getByRole("group", { name: "אוספים" }).getByRole("button", { name: "עם ברק" }).click();
    const grid = page.getByRole("list", { name: "תמונות" });
    await expect(grid.getByRole("button", { name: /ברק/ })).toHaveCount(2);
    await page.getByRole("group", { name: "אוספים" }).getByRole("button", { name: "עם המשחק" }).click();
    await expect(grid.getByRole("button", { name: /ברק/ })).toHaveCount(0);
  } finally {
    await sb.from("gallery_assets").update({ deleted_at: new Date().toISOString() }).like("original_filename", `e2e-${stamp}-%`);
  }
});
