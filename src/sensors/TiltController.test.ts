import { SPEED } from '../config';
import { TiltController, celdaDe } from './TiltController';

const rad = (g: number) => (g * Math.PI) / 180;

/** Muestra de un celular en vertical, con la pantalla inclinada `pitch`° hacia atrás y girada `rueda`° (horario = positivo) como volante. */
function pose(pitch: number, rueda: number): [number, number, number] {
  const horiz = Math.cos(rad(pitch));
  return [-horiz * Math.sin(rad(rueda)), horiz * Math.cos(rad(rueda)), Math.sin(rad(pitch))];
}

function estable(c: TiltController, p: [number, number, number]) {
  let r = null;
  for (let i = 0; i < 60; i++) r = c.muestra(...p);
  return r!;
}

describe('TiltController', () => {
  it('la postura inicial es el punto neutro', () => {
    const c = new TiltController();
    expect(estable(c, pose(45, 0))).toMatchObject({ traction: 0, steering: 0, vx: 0, vy: 0 });
  });

  it('inclinar la pantalla hacia adelante avanza y hacia atrás retrocede', () => {
    const c = new TiltController();
    estable(c, pose(25, 0));
    expect(estable(c, pose(70, 0)).traction).toBe(SPEED); // 45° = máximo
    expect(estable(c, pose(-20, 0)).traction).toBe(-SPEED);
    expect(estable(c, pose(35, 0)).traction).toBe(0); // 10°: dentro de la zona muerta (15°)
  });

  it('girar como volante en sentido horario gira a la derecha', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    expect(estable(c, pose(45, 60)).steering).toBe(SPEED);
    expect(estable(c, pose(45, -60)).steering).toBe(-SPEED);
    expect(estable(c, pose(45, 12)).steering).toBe(0); // inclinación chica: no mueve el robot
  });

  it('proporcional entre la zona muerta y el máximo', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    const r = estable(c, pose(45, 30)).steering; // a mitad de camino entre 15° y 45°
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(SPEED);
  });

  it('ignora las muestras de sacudidas / caída libre', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    expect(c.muestra(0, 0, 0.1)).toBeNull();
    expect(c.muestra(2, 1, 2)).toBeNull();
  });

  it('boca arriba sobre la mesa no controla nada', () => {
    const c = new TiltController();
    expect(estable(c, [0, 0, 1])).toMatchObject({ traction: 0, steering: 0 });
  });

  it('calibrar toma la postura actual como neutra', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    estable(c, pose(70, 0));
    c.calibrar();
    expect(estable(c, pose(70, 0)).traction).toBe(0);
  });
});

describe('TiltController: valores para la burbuja', () => {
  it('vx/vy siguen la inclinación sin zona muerta, entre −1 y 1', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    const r = estable(c, pose(45, 22.5));
    expect(r.steering).toBeGreaterThan(0);
    expect(r.vx).toBeCloseTo(0.5, 1); // 22,5° de 45°
    expect(estable(c, pose(45, 80)).vx).toBe(1);
    expect(estable(c, pose(67.5, 0)).vy).toBeCloseTo(0.5, 1);
    expect(estable(c, pose(20, 0)).vy).toBeLessThan(0);
  });
});

describe('celdaDe', () => {
  it('reparte la grilla 3x3 (4 = centro/stop)', () => {
    expect(celdaDe(0, 0)).toBe(4);
    expect(celdaDe(0, 0.9)).toBe(1); // adelante
    expect(celdaDe(0, -0.9)).toBe(7); // atrás
    expect(celdaDe(-0.9, 0)).toBe(3); // izquierda
    expect(celdaDe(0.9, 0)).toBe(5); // derecha
    expect(celdaDe(0.9, 0.9)).toBe(2); // adelante + derecha
    expect(celdaDe(0.3, -0.3)).toBe(4); // dentro de la zona muerta
  });

  it('coincide con la orden real: celda central ⇔ el robot está parado', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    for (const [p, w] of [[45, 0], [52, 5], [62, 0], [45, 25], [10, -30], [41, 0]] as const) {
      const r = estable(c, pose(p, w));
      expect(celdaDe(r.vx, r.vy) === 4).toBe(r.traction === 0 && r.steering === 0);
    }
  });
});

describe('TiltController: un movimiento rápido no maneja', () => {
  it('un temblor rápido de ±3° no mueve el robot, aunque pase la zona muerta en una muestra', () => {
    const c = new TiltController();
    estable(c, pose(45, 0));
    let max = 0;
    for (let i = 0; i < 200; i++) {
      const r = c.muestra(...pose(45 + 20 * Math.sin(i * 1.2), 20 * Math.cos(i * 1.7)))!; // ±20° a ~10 Hz
      if (r) max = Math.max(max, Math.abs(r.traction), Math.abs(r.steering));
    }
    expect(max).toBeLessThan(25); // el filtro lo aplana (sin filtro llegaría a 70)
  });
});

describe('TiltController: celular plano (pantalla hacia arriba)', () => {
  const sin = (g: number) => Math.sin(rad(g));
  const cos = (g: number) => Math.cos(rad(g));
  /** Plano, con la parte de arriba hacia abajo `adelante`° (negativo = hacia arriba) y el lado derecho hacia abajo `derecha`°. */
  const plano = (adelante: number, derecha: number): [number, number, number] => [-sin(derecha), -sin(adelante), cos(adelante) * cos(derecha)];

  it('inclinar la parte de arriba hacia abajo avanza y hacia arriba retrocede', () => {
    const c = new TiltController();
    estable(c, plano(0, 0));
    expect(estable(c, plano(25, 0)).traction).toBeGreaterThan(0);
    expect(estable(c, plano(-25, 0)).traction).toBeLessThan(0);
    expect(estable(c, plano(45, 0)).traction).toBe(SPEED);
    expect(estable(c, plano(-45, 0)).traction).toBe(-SPEED);
  });

  it('el adelante y el atrás son simétricos', () => {
    const c = new TiltController();
    estable(c, plano(0, 0));
    expect(estable(c, plano(30, 0)).traction).toBe(-estable(c, plano(-30, 0)).traction);
  });

  it('inclinar el lado derecho hacia abajo gira a la derecha, y el izquierdo a la izquierda', () => {
    const c = new TiltController();
    estable(c, plano(0, 0));
    expect(estable(c, plano(0, 30)).steering).toBeGreaterThan(0);
    expect(estable(c, plano(0, -30)).steering).toBeLessThan(0);
    expect(estable(c, plano(0, 8)).steering).toBe(0); // dentro de la zona muerta
  });

  it('quieto sobre la mesa queda parado, y boca abajo no controla', () => {
    const c = new TiltController();
    expect(estable(c, plano(0, 0))).toMatchObject({ traction: 0, steering: 0 });
    expect(estable(c, [0, 0, -1])).toMatchObject({ traction: 0, steering: 0 });
  });

  it('la inclinación de costado no se mezcla con el avance', () => {
    const c = new TiltController();
    estable(c, plano(0, 0));
    expect(estable(c, plano(0, 35)).traction).toBe(0);
    expect(estable(c, plano(35, 0)).steering).toBe(0);
  });
});
