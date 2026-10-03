// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loop - On-Device AI Agent",
    short_name: "Loop",
    description: "A tiny 50M on-device AI agent by ZEROLABS running 100% in browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6d5efc",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
