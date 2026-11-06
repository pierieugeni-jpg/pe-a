import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peña · Cuentas claras",
    short_name: "Peña",
    description: "Dividí los gastos de la peña y sabé quién le transfiere a quién.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#ea580c",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
