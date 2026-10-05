import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright-core";

// Server-side PNG export through headless Chromium. Fonts are inlined as data URIs
// so rendering never depends on the network; photos load from short-lived signed URLs.

let fontCssPromise: Promise<string> | null = null;

export function inlineFontCss(): Promise<string> {
  fontCssPromise ??= (async () => {
    const dir = path.join(process.cwd(), "public", "fonts");
    const css = await readFile(path.join(dir, "fonts.css"), "utf8");
    const files = Array.from(new Set(css.match(/\/fonts\/[\w.-]+\.woff2/g) ?? []));
    let out = css;
    for (const file of files) {
      const data = await readFile(path.join(dir, path.basename(file)));
      out = out.split(`url(${file})`).join(`url(data:font/woff2;base64,${data.toString("base64")})`);
    }
    return out;
  })();
  return fontCssPromise;
}

export function serverRenderAvailable(): boolean {
  return Boolean(process.env.CHROMIUM_PATH);
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import("playwright-core");
    browserPromise = chromium
      .launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--font-render-hinting=none", "--disable-gpu"] })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/** Renders standalone HTML documents to PNG buffers, one page per document. */
export async function renderPngs(documents: string[], size: { width: number; height: number }): Promise<Buffer[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: "he-IL" });
  try {
    const results: Buffer[] = [];
    for (const html of documents) {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.complete ? Promise.resolve() : new Promise((resolve) => img.addEventListener("load", resolve, { once: true })),
          ),
        );
      });
      results.push(await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } }));
      await page.close();
    }
    return results;
  } finally {
    await context.close();
  }
}
