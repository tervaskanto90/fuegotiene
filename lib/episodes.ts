import datos from "@/data/episodes.json";

export type Episodio = {
  /** s01e01 */
  id: string;
  temporada: number;
  numero: number;
  titulo: string;
  /** fecha de emisión original, ISO YYYY-MM-DD, o "" */
  emision: string;
  /** vacío a propósito: si se quieren sinopsis, se escriben */
  sinopsis: string;
  /** en segundos; 0 = desconocida */
  duracion: number;
  /** nombre del objeto en R2 */
  key: string;
  /** subtítulos .vtt en R2, o "" */
  sub: string;
  /** imagen en public/art/, o "" para usar la trama con el número */
  arte: string;
};

export const episodios: Episodio[] = [...(datos as Episodio[])].sort(
  (a, b) => a.temporada - b.temporada || a.numero - b.numero,
);

export function buscar(id: string): Episodio | undefined {
  return episodios.find((e) => e.id === id);
}

export function siguiente(id: string): Episodio | null {
  const i = episodios.findIndex((e) => e.id === id);
  return i >= 0 && i + 1 < episodios.length ? episodios[i + 1] : null;
}

export function anterior(id: string): Episodio | null {
  const i = episodios.findIndex((e) => e.id === id);
  return i > 0 ? episodios[i - 1] : null;
}

export function porTemporada(): { temporada: number; episodios: Episodio[] }[] {
  const mapa = new Map<number, Episodio[]>();
  for (const e of episodios) {
    if (!mapa.has(e.temporada)) mapa.set(e.temporada, []);
    mapa.get(e.temporada)!.push(e);
  }
  return [...mapa.entries()].map(([temporada, episodios]) => ({ temporada, episodios }));
}

/** "1x03" */
export function codigo(e: Pick<Episodio, "temporada" | "numero">): string {
  return `${e.temporada}x${String(e.numero).padStart(2, "0")}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "8 ene 2002". Sin locale del sistema para que servidor y navegador coincidan. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/** "47 min" */
export function duracionTexto(segundos: number): string {
  if (!segundos || segundos <= 0) return "";
  return `${Math.round(segundos / 60)} min`;
}

/** "12:41" o "1:02:03" */
export function tiempoTexto(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(r).padStart(2, "0")}`;
}
