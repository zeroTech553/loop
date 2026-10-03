import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loop - In-Browser AI Agent",
  description:
    "Loop is a tiny on-device AI agent (50M parameters) by ZEROLABS that runs 100% in your browser using WebGPU and WASM.",
  openGraph: {
    title: "Loop - In-Browser AI Agent",
    description:
      "A tiny on-device AI agent by ZEROLABS running 100% in your browser.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop - In-Browser AI Agent",
    description:
      "A tiny on-device AI agent by ZEROLABS running 100% in your browser.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6d5efc",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem("loop:settings:v1");
                if (s) {
                  var p = JSON.parse(s);
                  if (p.theme === "dark" || (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                    document.documentElement.setAttribute("data-theme", "dark");
                  } else if (p.theme === "light") {
                    document.documentElement.setAttribute("data-theme", "light");
                  }
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased min-h-[100dvh]">
        {children}
      </body>
    </html>
  );
}
