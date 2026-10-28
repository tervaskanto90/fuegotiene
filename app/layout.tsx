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
  // Para que las URL del <head> salgan absolutas (la tarjeta de compartir
  // las necesita así). Vercel la pondría sola, pero mejor no depender.
  metadataBase: new URL(sitio.direccion),
  title: { default: sitio.nombre, template: `%s · ${sitio.nombre}` },
  description: sitio.descripcion,
  robots: { index: false, follow: false },
  // La tarjeta que arma WhatsApp, Telegram o iMessage cuando alguien pega el
  // link: el sitio vive de que se pase la dirección. La imagen es
  // app/opengraph-image.png (1200×630), estática, generada con la llama y el
  // wordmark; Next la enlaza solo y Twitter/X la toma de acá también.
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: sitio.nombre,
    title: sitio.nombre,
    description: sitio.descripcion,
  },
  twitter: { card: "summary_large_image" },
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
