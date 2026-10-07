import { consultarVersion, evaluarVersion } from './actualizacion';

const OK = { versionCode: 3, versionName: '1.2.0', url: 'https://vr.lexodive.com/app/vrlexo-control.apk' };

describe('evaluarVersion', () => {
  it('ofrece la actualización si la versión publicada es mayor', () => {
    expect(evaluarVersion(2, OK)).toEqual(OK);
  });

  it('no ofrece nada si es la misma o una más vieja', () => {
    expect(evaluarVersion(3, OK)).toBeNull();
    expect(evaluarVersion(4, OK)).toBeNull();
  });

  it('rechaza una URL de otro sitio, con http o con usuario@host', () => {
    expect(evaluarVersion(1, { ...OK, url: 'https://malo.com/app/vrlexo-control.apk' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, url: 'http://vr.lexodive.com/app/vrlexo-control.apk' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, url: 'https://vr.lexodive.com@malo.com/x.apk' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, url: 'https://vr.lexodive.com.malo.com/x.apk' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, url: 'javascript:alert(1)' })).toBeNull();
  });

  it('acepta el host con mayúsculas o puerto', () => {
    expect(evaluarVersion(1, { ...OK, url: 'https://VR.LexoDive.com:443/app/a.apk' })).not.toBeNull();
  });

  it('rechaza formatos raros', () => {
    expect(evaluarVersion(1, null)).toBeNull();
    expect(evaluarVersion(1, 'hola')).toBeNull();
    expect(evaluarVersion(1, { ...OK, versionCode: '3' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, versionCode: 2.5 })).toBeNull();
    expect(evaluarVersion(1, { ...OK, versionName: '' })).toBeNull();
    expect(evaluarVersion(1, { ...OK, versionName: 'x'.repeat(50) })).toBeNull();
    expect(evaluarVersion(1, { versionCode: 3 })).toBeNull();
  });

  it('permite cambiar los hosts permitidos', () => {
    expect(evaluarVersion(1, { ...OK, url: 'https://otro.com/a.apk' }, ['otro.com'])).not.toBeNull();
  });
});

describe('consultarVersion', () => {
  const respuesta = (cuerpo: unknown, ok = true) => ({ ok, json: async () => cuerpo }) as Response;

  it('devuelve la actualización cuando el sitio publica una versión mayor', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(OK));
    expect(await consultarVersion(2, { fetchFn })).toEqual(OK);
    expect(fetchFn.mock.calls[0][0]).toMatch(/^https:\/\/vr\.lexodive\.com\/app\/version\.json\?t=\d+$/);
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });

  it('devuelve null sin molestar si falla la red, la respuesta no es ok o el JSON es inválido', async () => {
    expect(await consultarVersion(2, { fetchFn: jest.fn().mockRejectedValue(new Error('sin red')) })).toBeNull();
    expect(await consultarVersion(2, { fetchFn: jest.fn().mockResolvedValue(respuesta(OK, false)) })).toBeNull();
    const roto = { ok: true, json: async () => { throw new Error('json'); } } as unknown as Response;
    expect(await consultarVersion(2, { fetchFn: jest.fn().mockResolvedValue(roto) })).toBeNull();
  });

  it('no consulta si no se conoce la versión instalada', async () => {
    const fetchFn = jest.fn();
    expect(await consultarVersion(0, { fetchFn })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('corta la espera si el servidor tarda demasiado', async () => {
    const fetchFn = jest.fn((_u: string, o: { signal?: AbortSignal }) => new Promise((_res, rej) => o.signal?.addEventListener('abort', () => rej(new Error('abort')))));
    const inicio = Date.now();
    expect(await consultarVersion(2, { fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 50 })).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});
