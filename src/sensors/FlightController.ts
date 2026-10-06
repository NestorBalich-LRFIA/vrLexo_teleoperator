import { HELICE_ON, SACUDIDA } from '../config';
import { magnitud } from './vector';

/**
 * Hélice proporcional al movimiento vertical del celular: moverlo rápido hacia arriba y abajo hace volar el robot,
 * y cuanto más rápido, más alto. Al parar baja sola.
 *
 * Se mide la aceleración en la dirección de la gravedad (componente vertical) descontando la gravedad, así
 * inclinar el celular o sacudirlo de costado no cuenta. Es la amplitud del movimiento: más rápido = más aceleración.
 */
export class FlightController {
  private gx = 0;
  private gy = 0;
  private gz = 0;
  private iniciado = false;
  private envolvente = 0;

  /** Procesa una muestra (en g) y devuelve la hélice 0..100 (de a 5, para no mandar cambios mínimos). */
  muestra(x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) return this.nivel();
    if (!this.iniciado) {
      [this.gx, this.gy, this.gz] = [x, y, z];
      this.iniciado = true;
      return 0;
    }
    // La gravedad es la parte lenta de la señal; el movimiento, la rápida.
    const k = SACUDIDA.filtroGravedad;
    this.gx += k * (x - this.gx);
    this.gy += k * (y - this.gy);
    this.gz += k * (z - this.gz);
    const g = magnitud(this.gx, this.gy, this.gz);
    if (g < 0.3) return this.nivel(); // sin referencia de gravedad (caída libre sostenida)

    // Movimiento = señal − gravedad. Se separa en la parte a lo largo de la gravedad (vertical) y la lateral;
    // la lateral se descuenta para que sacudir de costado (o girar el celular) no cuente como volar.
    const dx = x - this.gx;
    const dy = y - this.gy;
    const dz = z - this.gz;
    const vert = Math.abs((dx * this.gx + dy * this.gy + dz * this.gz) / g);
    const lateral = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - vert * vert));
    const vertical = Math.max(0, vert - SACUDIDA.penalLateral * lateral);
    this.envolvente = Math.max(vertical, this.envolvente * SACUDIDA.decaimiento);
    return this.nivel();
  }

  private nivel(): number {
    const { minG, maxG } = SACUDIDA;
    const f = Math.min(1, Math.max(0, (this.envolvente - minG) / (maxG - minG)));
    return Math.round((f * HELICE_ON) / 5) * 5;
  }

  /** true mientras se está sacudiendo para volar (y un instante después): ahí la inclinación no debe mover el robot. */
  get activo(): boolean {
    return this.envolvente >= SACUDIDA.minG * SACUDIDA.umbralActivoFraccion;
  }

  reiniciar() {
    this.iniciado = false;
    this.envolvente = 0;
  }
}
