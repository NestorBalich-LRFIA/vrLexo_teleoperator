import { ALTURA } from '../config';

/**
 * Altura aproximada del robot (0..1) calculada a partir de la hélice que se manda; el servidor no informa la altura real.
 * El empuje (hélice) acelera hacia arriba, la gravedad hacia abajo y el arrastre limita la velocidad: agitar fuerte
 * acumula velocidad y sube más rápido; con poca hélice se cae.
 */
export class AlturaSimulada {
  altura = 0;
  velocidad = 0;

  /** Avanza `dt` segundos con la hélice (0..100) y devuelve la altura 0..1. */
  paso(helice: number, dt: number): number {
    const empuje = (Math.max(0, Math.min(100, helice)) / 100) * ALTURA.empuje;
    const dtSeguro = Math.min(Math.max(dt, 0), 0.1); // si la app se frena un rato, no dar un salto enorme
    const acel = empuje - ALTURA.gravedad - ALTURA.arrastre * this.velocidad;
    this.velocidad += acel * dtSeguro;
    this.altura += this.velocidad * dtSeguro;
    if (this.altura <= 0) {
      this.altura = 0;
      this.velocidad = Math.max(0, this.velocidad); // en el piso no se hunde
    } else if (this.altura >= 1) {
      this.altura = 1;
      this.velocidad = Math.min(0, this.velocidad); // en el techo no sigue subiendo
    }
    return this.altura;
  }
}
