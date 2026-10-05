import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const BUNDLED_PLAN_FILE = "Before_I_Do_60_Day_Content_System.xlsx";

/** The 60-day plan shipped with the project, if present. */
export async function readBundledPlan(): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(process.cwd(), "data", BUNDLED_PLAN_FILE));
  } catch {
    return null;
  }
}
