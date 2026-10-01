import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

// Inter para la interfaz; Instrument Serif para números grandes y títulos
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Winter Arc",
  description: "Competencia de hábitos del 1 de octubre al 31 de diciembre de 2026",
  // App instalable (PWA): manifest, ícono y modo pantalla completa en iPhone/Android
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "WINTER ARC",
    statusBarStyle: "black-translucent",
  },
  // Next solo escribe "mobile-web-app-capable"; los iPhone viejos necesitan la versión de Apple
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${inter.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-fg">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
