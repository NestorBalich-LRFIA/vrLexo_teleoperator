import { INCLINACION, SPEED } from '../config';
import { magnitud } from './vector';

export interface Inclinacion {
  traction: number;
  steering: number;
  /** Para dibujar la burbuja: −1..1 sin zona muerta (x: + derecha, y: + adelante). */
  vx: number;
  vy: number;
}

const aGrados = (rad: number) => (rad * 180) / Math.PI;

const recortar1 = (v: number) => Math.max(-1, Math.min(1, v)) || 0; // sin -0

/** Zona muerta + escala lineal hasta maxGrados → −1..1. */
function normalizar(grados: number): number {
  const { zonaMuertaGrados: zm, maxGrados: mx } = INCLINACION;
  const a = Math.abs(grados);
  if (a <= zm) return 0;
  return Math.sign(grados) * (Math.min(a, mx) - zm) / (mx - zm);
}

/**
 * Convierte el acelerómetro (en g, ejes del celular según Android: x derecha, y arriba, z hacia afuera de la pantalla;
 * en reposo la lectura apunta hacia arriba) en traction/steering, con el celular en VERTICAL.
 *  - Girar el celular como un volante (sentido horario = derecha) → steering.
 *  - Inclinar la parte de arriba de la pantalla hacia adelante (alejándola de vos) → traction positiva.
 * El punto neutro de avance se calibra solo con la primera muestra válida (o con `calibrar()`).
 */
/** Celda 0..8 de la grilla 3x3 (fila 0 = adelante, columna 0 = izquierda) donde está la bolita; 4 = centro (parado). */
export function celdaDe(vx: number, vy: number): number {
  const col = vx < -1 / 3 ? 0 : vx > 1 / 3 ? 2 : 1;
  const fila = vy > 1 / 3 ? 0 : vy < -1 / 3 ? 2 : 1;
  return fila * 3 + col;
}

export class TiltController {
  private fx = 0;
  private fy = 0;
  private fz = 0;
  private iniciado = false;
  private ultimaMs = 0;
  private pitchNeutro: number | null = null;

  /** Toma la postura actual como neutra. */
  calibrar() {
    this.pitchNeutro = null;
  }

  /** Procesa una muestra. Devuelve null si hay que ignorarla (sacudida) y {0,0} si está boca abajo. */
  muestra(x: number, y: number, z: number, ahoraMs?: number): Inclinacion | null {
    const g = magnitud(x, y, z);
    if (!Number.isFinite(g) || g < INCLINACION.gMin || g > INCLINACION.gMax) return null;

    // Suavizado exponencial en tiempo real (sin ahoraMs se asumen 20 ms entre muestras, como en los tests).
    const t = ahoraMs ?? this.ultimaMs + 20;
    const dt = Math.max(1, Math.min(200, t - this.ultimaMs));
    this.ultimaMs = t;
    const k = 1 - Math.exp(-dt / INCLINACION.suavizadoMs);
    if (!this.iniciado) {
      [this.fx, this.fy, this.fz] = [x, y, z];
      this.iniciado = true;
    } else {
      this.fx += k * (x - this.fx);
      this.fy += k * (y - this.fy);
      this.fz += k * (z - this.fz);
    }

    // Boca abajo no hay control.
    if (this.fz < -0.5) return { traction: 0, steering: 0, vx: 0, vy: 0 };

    // Postura: parado (pantalla hacia vos, fz chico) o plano (pantalla hacia arriba, fz ≈ 1). Se mezclan de forma
    // continua entre fz 0,70 y 0,82 para no tener saltos. Cada postura tiene su fórmula porque el mismo movimiento
    // se lee distinto: parado el giro es un volante en el plano de la pantalla; plano es inclinar de costado.
    const parado = Math.min(1, Math.max(0, (0.82 - this.fz) / 0.12));
    const plano = Math.hypot(this.fx, this.fy);

    // Adelante/atrás = ángulo de la parte de arriba del celular (0° parado, 90° plano, >90° inclinado hacia abajo).
    // Parado se ignora fx (el volante no debe sumar avance); plano se usa solo (y, z), con el signo de y, así
    // inclinar adelante o atrás con el celular plano no se lee igual y la inclinación de costado no suma avance.
    const pitchParado = aGrados(Math.atan2(this.fz, this.fy < 0 ? -plano : plano));
    const pitchPlano = aGrados(Math.atan2(this.fz, this.fy));
    const pitch = parado * pitchParado + (1 - parado) * pitchPlano;
    if (this.pitchNeutro === null) this.pitchNeutro = pitch;

    // Giro: parado = ángulo de volante (horario = derecha); plano = inclinación hacia el lado derecho.
    const volante = aGrados(Math.atan2(-this.fx, Math.abs(this.fy)));
    const costado = aGrados(Math.asin(Math.max(-1, Math.min(1, -this.fx / (magnitud(this.fx, this.fy, this.fz) || 1)))));
    const rueda = parado * volante + (1 - parado) * costado;

    const signoAvance = INCLINACION.invertirAvance ? -1 : 1;
    const signoGiro = INCLINACION.invertirGiro ? -1 : 1;
    const vy = recortar1(((pitch - this.pitchNeutro) / INCLINACION.maxGrados) * signoAvance);
    const vx = recortar1((rueda / INCLINACION.maxGrados) * signoGiro);
    const avance = normalizar(pitch - this.pitchNeutro) * (INCLINACION.invertirAvance ? -1 : 1);
    const giro = normalizar(rueda) * (INCLINACION.invertirGiro ? -1 : 1);
    return { traction: Math.round(SPEED * avance), steering: Math.round(SPEED * giro), vx, vy };
  }
}
