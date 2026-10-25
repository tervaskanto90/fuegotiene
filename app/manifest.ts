import type { MetadataRoute } from "next";
import { sitio } from "@/lib/site";

// El manifest es lo que deja "agregar a la pantalla de inicio" del teléfono
// con ícono propio y sin la barra del navegador. Next lo sirve en
// /manifest.webmanifest y lo enlaza solo desde el <head>. Sin service
// worker a propósito: nada se guarda en el teléfono fuera del progreso.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: sitio.nombre,
    short_name: sitio.nombre,
    description: sitio.descripcion,
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d1f26",
    theme_color: "#0d1f26",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
