import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/client/ui";
import { RegistrarSW } from "./registrar-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peña · Cuentas claras",
  description: "Dividí los gastos de la peña y sabé quién le transfiere a quién.",
  applicationName: "Peña",
  appleWebApp: { capable: true, title: "Peña", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ea580c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <RegistrarSW />
      </body>
    </html>
  );
}
