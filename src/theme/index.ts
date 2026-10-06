export const colores = {
  fondo: '#0b1220',
  superficie: '#162033',
  superficieAlta: '#1f2c45',
  borde: '#3a4a6b',
  texto: '#f5f7fb',
  textoSuave: '#b4c0d6',
  acento: '#4dabf7',
  textoSobreAcento: '#06101f',
  peligro: '#ff6b6b',
  ok: '#51cf66',
  aviso: '#fcc419',
};

export const radio = { boton: 28, tarjeta: 20, chico: 12 };

/** Tamaño mínimo de los botones de control (dp). */
export const BOTON_MIN = 96;

/** Elige texto negro o blanco según el brillo del color (contraste alto sobre el color del robot). */
export function textoSobre(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return colores.textoSobreAcento;
  const n = parseInt(m[1], 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.6 ? '#06101f' : '#ffffff';
}
