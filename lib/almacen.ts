// Dónde se guardan las anotaciones y las portadas: en el bucket si hay R2,
// y en la carpeta temporal del sistema en modo demo (se pierde al reiniciar,
// alcanza para probar). Sólo se usa desde rutas de servidor.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { leerR2, listarObjetos, pedirR2, type ConfigR2 } from "@/lib/r2";

export type Almacen = {
  modo: "r2" | "demo";
  leerBytes(key: string): Promise<Uint8Array | null>;
  escribirBytes(key: string, datos: Uint8Array, tipo: string): Promise<void>;
  /** keys que empiezan con el prefijo (hasta unos cientos) */
  listar(prefijo: string): Promise<string[]>;
};

function almacenR2(config: ConfigR2): Almacen {
  return {
    modo: "r2",
    async leerBytes(key) {
      const res = await pedirR2(config, key);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 respondió ${res.status} al leer ${key}.`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async escribirBytes(key, datos, tipo) {
      const res = await pedirR2(config, key, { method: "PUT", body: datos as BodyInit, headers: { "Content-Type": tipo } });
      if (!res.ok) throw new Error(`R2 respondió ${res.status} al guardar ${key}.`);
    },
    async listar(prefijo) {
      return (await listarObjetos(config, prefijo)).objetos.map((o) => o.key);
    },
  };
}

function almacenDemo(): Almacen {
  const carpeta = path.join(os.tmpdir(), "fuego-tiene-demo");
  const ruta = (key: string) => path.join(carpeta, key.replace(/\//g, "__"));
  return {
    modo: "demo",
    async leerBytes(key) {
      try {
        return new Uint8Array(await readFile(ruta(key)));
      } catch {
        return null;
      }
    },
    async escribirBytes(key, datos) {
      await mkdir(carpeta, { recursive: true });
      await writeFile(ruta(key), datos);
    },
    async listar(prefijo) {
      try {
        const marca = prefijo.replace(/\//g, "__");
        return (await readdir(carpeta)).filter((n) => n.startsWith(marca)).map((n) => n.replace(/__/g, "/"));
      } catch {
        return [];
      }
    },
  };
}

export function almacen(): Almacen {
  const r2 = leerR2();
  return r2 ? almacenR2(r2) : almacenDemo();
}

export async function leerJson(a: Almacen, key: string): Promise<unknown | null> {
  const bytes = await a.leerBytes(key);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export async function escribirJson(a: Almacen, key: string, datos: unknown): Promise<void> {
  await a.escribirBytes(key, new TextEncoder().encode(JSON.stringify(datos, null, 1)), "application/json");
}
