import {
  ESQUEMA_PROPIO,
  HOSTS_DEBUG,
  HOSTS_PERMITIDOS,
  HOST_ESQUEMA_PROPIO,
  PATH_APP,
} from '../config';

export type ErrorQr = 'vacio' | 'formato' | 'esquema' | 'host' | 'ruta' | 'falta_s' | 'falta_t' | 'servidor';

export type ResultadoQr = { ok: true; url: string; token: string } | { ok: false; error: ErrorQr };

export interface OpcionesQr {
  /** En debug se aceptan localhost / IP local y `ws://`. Por defecto `__DEV__`. */
  debug?: boolean;
  hostsPermitidos?: string[];
}

const MAX_LARGO = 4096;

const RE_URL = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

function esDebugPorDefecto(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/** IPv4 privada o de loopback (192.168.x, 10.x, 172.16-31.x, 127.x): sirve para probar en la red local. */
export function esIpLocal(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return false;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function decodificar(s: string): string | null {
  try {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
  } catch {
    return null;
  }
}

/** Lee `k=v&k=v` (del fragmento o de la query). Devuelve null si algún valor no se puede decodificar. */
function leerParametros(texto: string | undefined): Record<string, string> | null {
  const out: Record<string, string> = {};
  if (!texto) return out;
  for (const par of texto.split('&')) {
    if (!par) continue;
    const i = par.indexOf('=');
    const k = decodificar(i < 0 ? par : par.slice(0, i));
    const v = decodificar(i < 0 ? '' : par.slice(i + 1));
    if (k === null || v === null) return null;
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function hostSinPuerto(autoridad: string): string | null {
  if (autoridad.includes('@')) return null; // nada de usuario@host
  const h = autoridad.replace(/:\d*$/, '').toLowerCase();
  return h || null;
}

/**
 * Valida el contenido de un QR (o enlace pegado) y devuelve la URL del WebSocket y el token.
 * Acepta:
 *   https://vr.lexodive.com/app/#s=<wss-url-urlencoded>&t=<token>
 *   vrlexo://join?s=<wss-url-urlencoded>&t=<token>
 */
export function parseJoinUrl(entrada: string, opciones: OpcionesQr = {}): ResultadoQr {
  const debug = opciones.debug ?? esDebugPorDefecto();
  const hosts = (opciones.hostsPermitidos ?? HOSTS_PERMITIDOS).map((h) => h.toLowerCase());
  const texto = (entrada ?? '').trim();
  if (!texto) return { ok: false, error: 'vacio' };
  if (texto.length > MAX_LARGO) return { ok: false, error: 'formato' };

  const m = RE_URL.exec(texto);
  if (!m) return { ok: false, error: 'formato' };
  const esquema = m[1].toLowerCase();
  const host = hostSinPuerto(m[2]);
  const ruta = m[3];
  let params: Record<string, string> | null;

  if (esquema === 'https') {
    if (!host) return { ok: false, error: 'host' };
    const permitido = hosts.includes(host) || (debug && (HOSTS_DEBUG.includes(host) || esIpLocal(host)));
    if (!permitido) return { ok: false, error: 'host' };
    if (!ruta.startsWith(PATH_APP)) return { ok: false, error: 'ruta' };
    params = leerParametros(m[5]); // los datos van en el fragmento, no en la query
  } else if (esquema === ESQUEMA_PROPIO) {
    if (host !== HOST_ESQUEMA_PROPIO) return { ok: false, error: 'host' };
    params = leerParametros(m[4]);
  } else {
    return { ok: false, error: 'esquema' };
  }

  if (!params) return { ok: false, error: 'formato' };
  const s = params.s;
  const t = params.t;
  if (!s) return { ok: false, error: 'falta_s' };
  if (!t) return { ok: false, error: 'falta_t' };
  const okWss = s.startsWith('wss://') || (debug && s.startsWith('ws://'));
  if (!okWss || /\s/.test(s) || s.length <= 6) return { ok: false, error: 'servidor' };
  return { ok: true, url: s, token: t };
}
