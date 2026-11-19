"use client";

// El progreso vive en el localStorage de cada navegador. No hay base de datos.

import { useCallback, useEffect, useState } from "react";

export type Progreso = {
  /** segundos vistos */
  t: number;
  /** duración total en segundos, si se conoce */
  d: number;
  /** última vez que se guardó, ms */
  en: number;
  visto: boolean;
};

export type MapaProgreso = Record<string, Progreso>;

export const CLAVE = "ft.progreso";
/** A partir de este porcentaje el capítulo cuenta como visto. */
export const UMBRAL_VISTO = 0.92;
/** Menos que esto no vale la pena ofrecer "seguir desde". */
export const MINIMO_REANUDAR_S = 15;

export function leerProgreso(): MapaProgreso {
  if (typeof window === "undefined") return {};
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const datos = JSON.parse(crudo);
    return datos && typeof datos === "object" ? (datos as MapaProgreso) : {};
  } catch {
    return {};
  }
}

function escribir(mapa: MapaProgreso) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(mapa));
  } catch {
    // sin espacio o modo privado: se sigue sin guardar
  }
}

export function guardarProgreso(id: string, t: number, d: number): MapaProgreso {
  const mapa = leerProgreso();
  const previo = mapa[id];
  const visto = (previo?.visto ?? false) || (d > 0 && t / d >= UMBRAL_VISTO);
  mapa[id] = { t: Math.floor(t), d: Math.floor(d || previo?.d || 0), en: Date.now(), visto };
  escribir(mapa);
  return mapa;
}

export function marcarVisto(id: string, visto = true): MapaProgreso {
  const mapa = leerProgreso();
  const previo = mapa[id];
  mapa[id] = { t: visto ? previo?.d ?? previo?.t ?? 0 : 0, d: previo?.d ?? 0, en: Date.now(), visto };
  escribir(mapa);
  return mapa;
}

/**
 * Devuelve el mapa con `id` vuelto a como estaba (`previo`), o sin él si no
 * tenía nada. Es el "deshacer" de marcar como visto: recupera la posición
 * exacta, que `marcarVisto(id, false)` perdería.
 */
export function conPrevio(mapa: MapaProgreso, id: string, previo: Progreso | undefined): MapaProgreso {
  const nuevo = { ...mapa };
  if (previo) nuevo[id] = { ...previo };
  else delete nuevo[id];
  return nuevo;
}

export function reponerProgreso(id: string, previo: Progreso | undefined): MapaProgreso {
  const mapa = conPrevio(leerProgreso(), id, previo);
  escribir(mapa);
  return mapa;
}

/** ¿Se puede ofrecer "seguir desde"? */
export function reanudable(p: Progreso | undefined): boolean {
  if (!p || p.visto) return false;
  if (p.t < MINIMO_REANUDAR_S) return false;
  if (p.d > 0 && p.t / p.d >= UMBRAL_VISTO) return false;
  return true;
}

/** Los capítulos a medias (los que se pueden seguir), del más reciente al más viejo. */
export function aMedias(mapa: MapaProgreso): { id: string; p: Progreso }[] {
  return Object.entries(mapa)
    .filter(([, p]) => reanudable(p))
    .map(([id, p]) => ({ id, p }))
    .sort((a, b) => b.p.en - a.p.en);
}

/**
 * De una lista de capítulos en orden de emisión, el primero que todavía no se
 * vio. Si quedó a medias, `desde` trae dónde seguir; si no, es `null`.
 */
export function proximoSinVer(ids: string[], mapa: MapaProgreso): { id: string; desde: number | null } | null {
  for (const id of ids) {
    const p = mapa[id];
    if (p?.visto) continue;
    if (p && p.d > 0 && p.t / p.d >= UMBRAL_VISTO) continue;
    return { id, desde: reanudable(p) ? p!.t : null };
  }
  return null;
}

/** El capítulo empezado más recientemente que no está terminado. */
export function ultimoEmpezado(mapa: MapaProgreso): { id: string; p: Progreso } | null {
  let mejor: { id: string; p: Progreso } | null = null;
  for (const [id, p] of Object.entries(mapa)) {
    if (!reanudable(p)) continue;
    if (!mejor || p.en > mejor.p.en) mejor = { id, p };
  }
  return mejor;
}

export function useProgreso() {
  const [mapa, setMapa] = useState<MapaProgreso>({});
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setMapa(leerProgreso());
    setListo(true);
    const alCambiar = (e: StorageEvent) => {
      if (e.key === null || e.key === CLAVE) setMapa(leerProgreso());
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const guardar = useCallback((id: string, t: number, d: number) => {
    setMapa(guardarProgreso(id, t, d));
  }, []);

  const marcar = useCallback((id: string, visto = true) => {
    setMapa(marcarVisto(id, visto));
  }, []);

  const reponer = useCallback((id: string, previo: Progreso | undefined) => {
    setMapa(reponerProgreso(id, previo));
  }, []);

  return { mapa, listo, guardar, marcar, reponer };
}
