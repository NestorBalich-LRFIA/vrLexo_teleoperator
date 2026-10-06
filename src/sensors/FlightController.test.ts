import { FlightController } from './FlightController';

const DT = 0.02; // 50 Hz

/** Celular quieto, vertical (gravedad en y), con un movimiento vertical senoidal de `amp` g a `hz` Hz durante `seg`. */
function correr(f: FlightController, amp: number, hz: number, seg: number, eje: 'y' | 'x' = 'y'): number[] {
  const out: number[] = [];
  for (let i = 0; i < seg / DT; i++) {
    const a = amp * Math.sin(2 * Math.PI * hz * i * DT);
    out.push(eje === 'y' ? f.muestra(0, 1 + a, 0) : f.muestra(a, 1, 0));
  }
  return out;
}

const maximo = (v: number[]) => Math.max(...v);

describe('FlightController', () => {
  it('quieto no vuela', () => {
    const f = new FlightController();
    expect(maximo(correr(f, 0, 3, 2))).toBe(0);
  });

  it('moverlo rápido arriba y abajo vuela, y más rápido vuela más alto', () => {
    const suave = maximo(correr(new FlightController(), 0.6, 3, 2));
    const medio = maximo(correr(new FlightController(), 1.0, 3, 2));
    const fuerte = maximo(correr(new FlightController(), 2.0, 3, 2));
    expect(suave).toBeGreaterThan(0);
    expect(medio).toBeGreaterThan(suave);
    expect(fuerte).toBeGreaterThanOrEqual(medio);
    expect(fuerte).toBe(100);
  });

  it('sacudir de costado no hace volar', () => {
    expect(maximo(correr(new FlightController(), 1.5, 3, 2, 'x'))).toBe(0);
  });

  it('al parar el movimiento la hélice baja a 0 en menos de un segundo', () => {
    const f = new FlightController();
    correr(f, 1.5, 3, 2);
    const despues = correr(f, 0, 3, 1);
    expect(despues.at(-1)).toBe(0);
  });

  it('un movimiento chico pero rápido ya hace volar', () => {
    const pico = maximo(correr(new FlightController(), 0.5, 8, 1.5)); // 0,5 g a 8 Hz = desplazamiento de unos 2 mm
    expect(pico).toBeGreaterThan(20);
  });

  it('mientras se sacude está activo (para anular la inclinación) y se desactiva al parar', () => {
    const f = new FlightController();
    expect(f.activo).toBe(false);
    correr(f, 0.5, 8, 1);
    expect(f.activo).toBe(true);
    correr(f, 0, 3, 1);
    expect(f.activo).toBe(false);
  });

  it('el pulso del pulgar o la vibración al apretar un botón no hace volar', () => {
    const f = new FlightController();
    expect(maximo(correr(f, 0.06, 12, 2))).toBe(0);
  });

  it('inclinar el celular lentamente no cuenta como movimiento', () => {
    const f = new FlightController();
    f.muestra(0, 1, 0);
    let max = 0;
    for (let i = 0; i <= 100; i++) {
      const ang = (60 * Math.PI) / 180 * (i / 100); // 0..60° en 2 s
      max = Math.max(max, f.muestra(0, Math.cos(ang), Math.sin(ang)));
    }
    expect(max).toBe(0);
  });

  it('ignora valores no finitos', () => {
    const f = new FlightController();
    expect(f.muestra(NaN, 1, 0)).toBe(0);
  });
});
