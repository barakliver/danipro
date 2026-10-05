import { expect, test } from "@playwright/test";
import { db, workspaceId } from "./support/db";

test("Filming day: plan looks from time + resources, check off a shot, it becomes filmed", async ({ page }) => {
  const sb = await db();
  const ws = await workspaceId();
  try {
    await page.goto("/filming");
    await expect(page.getByRole("heading", { name: "יום צילום" })).toBeVisible();
    await page.getByRole("button", { name: "45 דק׳" }).click();
    // without the game, nothing that needs it is planned
    await page.getByRole("button", { name: "המשחק", exact: true }).click();
    await expect(page.getByText(/^LOOK 1$/)).toBeVisible();
    await expect(page.getByText("עם המשחק", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "יאללה, מתחילים" }).click();
    const shot = page.getByRole("checkbox").first();
    await expect(shot).toHaveAttribute("aria-checked", "false");
    await shot.click();
    await expect(shot).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/^1 מתוך \d+ צולמו/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");
    const { data: done } = await sb.from("filming_session_items").select("content_id, content:content_items(status)").eq("workspace_id", ws).not("done_at", "is", null);
    expect(done?.length).toBe(1);
    expect((done![0].content as unknown as { status: string }).status).toBe("filmed");
  } finally {
    const { data: items } = await sb.from("filming_session_items").select("content_id").eq("workspace_id", ws).not("done_at", "is", null);
    for (const item of items ?? []) await sb.from("content_items").update({ status: "ready_to_film" }).eq("id", item.content_id).eq("status", "filmed");
    await sb.from("filming_sessions").delete().eq("workspace_id", ws);
  }
});
