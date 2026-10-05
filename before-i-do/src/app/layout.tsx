import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Before I Do Content Studio", template: "%s · Before I Do" },
  description: "הסטודיו הפרטי של Before I Do לתוכן.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Before I Do", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f6f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* one @font-face sheet with unicode ranges, shared with the graphic renderer */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="preload" href="/fonts/ibm-plex-sans-hebrew-hebrew-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/frank-ruhl-libre-hebrew-500-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          dir="rtl"
          position="top-center"
          toastOptions={{
            className: "!font-sans !rounded-[var(--radius-field)] !border-rule !bg-surface !text-ink",
          }}
        />
      </body>
    </html>
  );
}
