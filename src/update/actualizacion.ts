import { HOSTS_PERMITIDOS, URL_VERSION, VERSION_TIMEOUT_MS } from '../config';

/** Contenido de `version.json`, publicado junto al APK. */
export interface Actualizacion {
  versionCode: number;
  versionName: string;
  /** URL del APK (siempre https y de un host permitido). */
  url: string;
}

function hostDe(url: string): string | null {
  const m = /^https:\/\/([^/?#@]+)(?:[/?#]|$)/i.exec(url);
  return m ? m[1].replace(/:\d+$/, '').toLowerCase() : null;
}

/**
 * Decide si `datos` (el JSON publicado) describe una versión más nueva que `versionCodeLocal`.
 * Devuelve null si no hay nada que ofrecer o si el archivo no es de fiar (formato raro, URL de otro sitio, http).
 */
export function evaluarVersion(versionCodeLocal: number, datos: unknown, hosts: string[] = HOSTS_PERMITIDOS): Actualizacion | null {
  if (!datos || typeof datos !== 'object') return null;
  const d = datos as Record<string, unknown>;
  const { versionCode, versionName, url } = d;
  if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode <= versionCodeLocal) return null;
  if (typeof versionName !== 'string' || versionName.length === 0 || versionName.length > 32) return null;
  if (typeof url !== 'string' || url.length > 2048) return null;
  const host = hostDe(url);
  if (!host || !hosts.map((h) => h.toLowerCase()).includes(host)) return null; // solo descargas del sitio de VR Lexo
  return { versionCode, versionName, url };
}

export interface OpcionesConsulta {
  url?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  hosts?: string[];
}

/** Consulta `version.json`. Si no hay red, tarda o falla: null (la app sigue normal, sin molestar). */
export async function consultarVersion(versionCodeLocal: number, opciones: OpcionesConsulta = {}): Promise<Actualizacion | null> {
  if (!versionCodeLocal) return null;
  const f = opciones.fetchFn ?? fetch;
  const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controlador?.abort(), opciones.timeoutMs ?? VERSION_TIMEOUT_MS);
  try {
    const base = opciones.url ?? URL_VERSION;
    const r = await f(`${base}?t=${Date.now()}`, { cache: 'no-store', signal: controlador?.signal });
    if (!r.ok) return null;
    return evaluarVersion(versionCodeLocal, await r.json(), opciones.hosts);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
