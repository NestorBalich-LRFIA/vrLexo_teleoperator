import { AlturaSimulada } from './AlturaSimulada';

function correr(a: AlturaSimulada, helice: number, seg: number): number {
  let h = a.altura;
  for (let i = 0; i < seg / 0.033; i++) h = a.paso(helice, 0.033);
  return h;
}

describe('AlturaSimulada', () => {
  it('con la hélice al máximo sube hasta el tope', () => {
    const a = new AlturaSimulada();
    expect(correr(a, 100, 3)).toBe(1);
  });

  it('con la hélice apagada se queda en el piso', () => {
    const a = new AlturaSimulada();
    expect(correr(a, 0, 2)).toBe(0);
    expect(a.velocidad).toBe(0);
  });

  it('con poca hélice no despega', () => {
    expect(correr(new AlturaSimulada(), 15, 3)).toBe(0);
  });

  it('más hélice acumula más velocidad y sube más rápido', () => {
    const suave = correr(new AlturaSimulada(), 50, 1);
    const fuerte = correr(new AlturaSimulada(), 100, 1);
    expect(suave).toBeGreaterThan(0);
    expect(fuerte).toBeGreaterThan(suave);
  });

  it('acumula velocidad: al segundo sube más por segundo que al principio', () => {
    const a = new AlturaSimulada();
    const h1 = correr(a, 80, 0.5);
    const h2 = correr(a, 80, 0.5) - h1;
    expect(h2).toBeGreaterThan(h1);
  });

  it('al apagar la hélice baja y llega al piso', () => {
    const a = new AlturaSimulada();
    correr(a, 100, 3);
    const baja = correr(a, 0, 1);
    expect(baja).toBeLessThan(1);
    expect(correr(a, 0, 5)).toBe(0);
  });

  it('un dt enorme no da saltos', () => {
    const a = new AlturaSimulada();
    a.paso(100, 5);
    expect(a.altura).toBeLessThan(0.05); // sin el tope de 0,1 s llegaría al techo (1)
  });
});
