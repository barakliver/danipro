import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { db } from "./support/db";

async function createDraft(page: Page, text: string, format: "סטורי" | "קרוסלה"): Promise<string> {
  await page.goto("/create");
  await page.getByPlaceholder("אמא שלו רוצה להזמין עוד 40 אנשים שאנחנו לא מכירים").fill(text);
  await page.getByRole("radiogroup", { name: "פורמט" }).getByRole("radio", { name: format, exact: true }).click();
  await page.getByRole("button", { name: /^צור (טיוטה|אחד)$/ }).click();
  // the option card shows a discreet "Sounds Like Us" score
  await expect(page.getByLabel(/^נשמע כמו אנחנו: \d+/).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "לשמור ולערוך" }).first().click();
  await page.waitForURL("**/content/**");
  return page.url().split("/content/")[1].split("?")[0];
}

async function cleanup(id: string | null) {
  if (!id) return;
  const sb = await db();
  await sb.from("content_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

test("Story: create, edit a frame, export a 1080×1920 PNG", async ({ page }) => {
  let id: string | null = null;
  try {
    id = await createDraft(page, "אמא שלו רוצה להוסיף עוד 40 מוזמנים שאנחנו לא מכירים", "סטורי");
    const frame = page.getByRole("article", { name: "פריים 1" });
    await frame.getByLabel("טקסט הפריים").fill("אמא שלו רוצה להוסיף עוד 40 מוזמנים.");
    await expect(page.getByText(/^נשמר \d/)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("tab", { name: "ויזואל" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "הורדת פריים 1" }).click();
    const download = await downloadPromise;
    const meta = await sharp(await readFile((await download.path())!)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 1080, 1920]);
  } finally {
    await cleanup(id);
  }
});

test("Carousel: create, edit/reorder/duplicate/delete slides, export ZIP", async ({ page }) => {
  let id: string | null = null;
  try {
    id = await createDraft(page, "דברים ששניכם בטוחים שאתם מסכימים עליהם עד שמתחילים לתכנן חתונה", "קרוסלה");
    const slides = page.getByRole("article", { name: /^שקף/ });
    const before = await slides.count();
    expect(before).toBeGreaterThanOrEqual(3);

    const second = slides.nth(1);
    await second.getByRole("textbox").fill("מה זה 'חתונה קטנה'");
    await second.getByRole("button", { name: "שכפול שקף" }).click();
    await expect(slides).toHaveCount(before + 1);
    await slides.nth(2).getByRole("button", { name: "מחיקת שקף" }).click();
    await expect(slides).toHaveCount(before);
    await slides.nth(1).getByRole("button", { name: "להזיז אחורה" }).click();
    await expect(slides.nth(2).getByRole("textbox")).toHaveValue("מה זה 'חתונה קטנה'");
    await expect(page.getByText(/^נשמר \d/)).toBeVisible({ timeout: 20_000 });

    const response = await page.request.get(`/api/export/${id}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("zip");
    const zip = await response.body();
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(zip.length).toBeGreaterThan(20_000);
  } finally {
    await cleanup(id);
  }
});
