import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { sitio } from "@/lib/site";
import "./globals.css";

const archivo = localFont({
  src: "./fonts/Archivo.woff2",
  weight: "400 700",
  variable: "--font-archivo",
  display: "swap",
});

const narrow = localFont({
  src: "./fonts/ArchivoNarrow.woff2",
  weight: "400 700",
  variable: "--font-narrow",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: sitio.nombre, template: `%s · ${sitio.nombre}` },
  description: sitio.descripcion,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d1f26",
  width: "device-width",
  initialScale: 1,
  // Que el fondo llegue hasta el borde en los teléfonos con muesca. Lo que
  // no puede quedar debajo de la muesca ni de la barra de gestos —los
  // márgenes del contenido y los controles del reproductor— se corre con
  // env(safe-area-inset-*) en globals.css.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${narrow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
