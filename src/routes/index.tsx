import { createFileRoute } from "@tanstack/react-router";

import { SmartProApp } from "@/components/smartpro/smartpro-app";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMartPro Audio Video Production" },
      {
        name: "description",
        content:
          "Katalog rental kamera, wireless video, dan perangkat live production SMartPro dengan pemesanan online.",
      },
      { property: "og:title", content: "SMartPro Audio Video Production" },
      {
        property: "og:description",
        content:
          "Katalog rental kamera, wireless video, dan perangkat live production SMartPro dengan pemesanan online.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: SmartProApp,
});
