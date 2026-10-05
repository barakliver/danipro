"use client";

// Browser-side export, used when the server has no Chromium. Renders the exact same
// document in an offscreen iframe and rasterizes it with html-to-image.

export async function renderInBrowser(html: string, size: { width: number; height: number }): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${size.width}px;height:${size.height}px;border:0;`;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument!;
    await doc.fonts.ready;
    await Promise.all(
      Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener("load", r, { once: true })))),
    );
    // html-to-image needs one warm-up pass on Safari to embed fonts and images reliably
    await toBlob(doc.body, { width: size.width, height: size.height, pixelRatio: 1 });
    const blob = await toBlob(doc.body, { width: size.width, height: size.height, pixelRatio: 1, cacheBust: false });
    if (!blob) throw new Error("לא הצלחנו ליצור את התמונה");
    return blob;
  } finally {
    iframe.remove();
  }
}

/** Phone: share sheet (save to Photos). Desktop: regular download. */
export async function deliverFiles(files: File[]): Promise<"shared" | "downloaded" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && nav.canShare?.({ files })) {
    try {
      await nav.share({ files });
      return "shared";
    } catch (error) {
      if ((error as Error).name === "AbortError") return "cancelled";
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return "downloaded";
}
