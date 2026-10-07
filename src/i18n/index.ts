import { IDIOMA_FORZADO } from '../config';
import { en } from './en';
import { es, type Claves } from './es';
import { pt } from './pt';
import type { CodigoFin, Fin } from '../net/ExtClient';
import type { ErrorQr } from '../qr/parseJoinUrl';

const idiomas: Record<string, Record<Claves, string>> = { es, en, pt };

function idiomaDelSistema(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale ?? 'es';
    const base = loc.slice(0, 2).toLowerCase();
    return base in idiomas ? base : 'es';
  } catch {
    return 'es';
  }
}

let actual = IDIOMA_FORZADO && IDIOMA_FORZADO in idiomas ? IDIOMA_FORZADO : idiomaDelSistema();

export function setIdioma(codigo: string) {
  if (codigo in idiomas) actual = codigo;
}

/** Traduce una clave, reemplazando `{{param}}`. */
export function t(clave: Claves, params: Record<string, string | number> = {}): string {
  const texto = idiomas[actual][clave] ?? es[clave];
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}

const claveError: Record<ErrorQr, Claves> = {
  vacio: 'qrVacio',
  formato: 'qrFormato',
  esquema: 'qrEsquema',
  host: 'qrHost',
  ruta: 'qrRuta',
  falta_s: 'qrFaltaDato',
  falta_t: 'qrFaltaDato',
  servidor: 'qrServidor',
};

export function textoErrorQr(error: ErrorQr): string {
  return t(claveError[error]);
}

const claveFin: Record<CodigoFin, Claves> = {
  token_revocado: 'finTokenRevocado',
  token_invalido: 'finTokenInvalido',
  aula_llena: 'finAulaLlena',
  modo_apagado: 'finModoApagado',
  simulador_no_responde: 'finSimulador',
  error_servidor: 'finOtro',
  cerrado_servidor: 'finCerrado',
  expulsado: 'finExpulsado',
  sin_conexion: 'finSinConexion',
  sin_respuesta: 'finSinRespuesta',
  salio: 'finCerrado',
};

export function textoFin(fin: Fin): string {
  return t(claveFin[fin.codigo], { texto: fin.texto ?? '', motivo: fin.texto ?? '' });
}
