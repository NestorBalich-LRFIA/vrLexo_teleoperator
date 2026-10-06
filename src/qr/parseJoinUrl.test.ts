import { parseJoinUrl } from './parseJoinUrl';

const S = encodeURIComponent('wss://vr.lexodive.com/simengine/ws');
const URL_OK = `https://vr.lexodive.com/app/#s=${S}&t=eyJhbGciOi.abc_-123`;

describe('parseJoinUrl', () => {
  it('acepta la URL válida del QR', () => {
    expect(parseJoinUrl(URL_OK, { debug: false })).toEqual({
      ok: true,
      url: 'wss://vr.lexodive.com/simengine/ws',
      token: 'eyJhbGciOi.abc_-123',
    });
  });

  it('acepta espacios alrededor y el host en mayúsculas', () => {
    const r = parseJoinUrl(`  https://VR.LexoDive.com/app/#s=${S}&t=x  `, { debug: false });
    expect(r.ok).toBe(true);
  });

  it('rechaza un host no permitido', () => {
    const r = parseJoinUrl(`https://malo.com/app/#s=${S}&t=x`, { debug: false });
    expect(r).toEqual({ ok: false, error: 'host' });
  });

  it('rechaza un host que solo contiene el permitido', () => {
    expect(parseJoinUrl(`https://vr.lexodive.com.malo.com/app/#s=${S}&t=x`, { debug: false })).toEqual({
      ok: false,
      error: 'host',
    });
    expect(parseJoinUrl(`https://vr.lexodive.com@malo.com/app/#s=${S}&t=x`, { debug: false })).toEqual({
      ok: false,
      error: 'host',
    });
  });

  it('rechaza http y otros esquemas', () => {
    expect(parseJoinUrl(`http://vr.lexodive.com/app/#s=${S}&t=x`, { debug: false })).toEqual({ ok: false, error: 'esquema' });
    expect(parseJoinUrl('javascript://vr.lexodive.com/app/#s=a&t=b', { debug: false })).toEqual({ ok: false, error: 'esquema' });
  });

  it('rechaza si falta t', () => {
    expect(parseJoinUrl(`https://vr.lexodive.com/app/#s=${S}`, { debug: false })).toEqual({ ok: false, error: 'falta_t' });
    expect(parseJoinUrl(`https://vr.lexodive.com/app/#s=${S}&t=`, { debug: false })).toEqual({ ok: false, error: 'falta_t' });
  });

  it('rechaza si falta s', () => {
    expect(parseJoinUrl('https://vr.lexodive.com/app/#t=abc', { debug: false })).toEqual({ ok: false, error: 'falta_s' });
  });

  it('los datos en la query (no en el fragmento) no valen', () => {
    expect(parseJoinUrl(`https://vr.lexodive.com/app/?s=${S}&t=x`, { debug: false }).ok).toBe(false);
  });

  it('rechaza una ruta fuera de /app/', () => {
    expect(parseJoinUrl(`https://vr.lexodive.com/otra/#s=${S}&t=x`, { debug: false })).toEqual({ ok: false, error: 'ruta' });
  });

  it('rechaza ws:// en release y lo acepta en debug', () => {
    const ws = encodeURIComponent('ws://192.168.0.5:8787');
    expect(parseJoinUrl(`https://vr.lexodive.com/app/#s=${ws}&t=x`, { debug: false })).toEqual({ ok: false, error: 'servidor' });
    expect(parseJoinUrl(`https://vr.lexodive.com/app/#s=${ws}&t=x`, { debug: true })).toEqual({
      ok: true,
      url: 'ws://192.168.0.5:8787',
      token: 'x',
    });
  });

  it('rechaza s que no es ws(s)', () => {
    const s = encodeURIComponent('https://vr.lexodive.com/simengine/ws');
    expect(parseJoinUrl(`https://vr.lexodive.com/app/#s=${s}&t=x`, { debug: true })).toEqual({ ok: false, error: 'servidor' });
  });

  it('localhost e IP local solo en debug', () => {
    const ws = encodeURIComponent('ws://10.0.2.2:8787');
    expect(parseJoinUrl(`https://192.168.1.20/app/#s=${ws}&t=x`, { debug: true }).ok).toBe(true);
    expect(parseJoinUrl(`https://localhost:3000/app/#s=${ws}&t=x`, { debug: true }).ok).toBe(true);
    expect(parseJoinUrl(`https://192.168.1.20/app/#s=${ws}&t=x`, { debug: false })).toEqual({ ok: false, error: 'host' });
    expect(parseJoinUrl(`https://8.8.8.8/app/#s=${ws}&t=x`, { debug: true })).toEqual({ ok: false, error: 'host' });
  });

  it('acepta el esquema propio vrlexo://join', () => {
    expect(parseJoinUrl(`vrlexo://join?s=${S}&t=tok`, { debug: false })).toEqual({
      ok: true,
      url: 'wss://vr.lexodive.com/simengine/ws',
      token: 'tok',
    });
    expect(parseJoinUrl(`vrlexo://otro?s=${S}&t=tok`, { debug: false })).toEqual({ ok: false, error: 'host' });
    expect(parseJoinUrl(`vrlexo://join?s=${encodeURIComponent('ws://a.b')}&t=tok`, { debug: false })).toEqual({
      ok: false,
      error: 'servidor',
    });
  });

  it('rechaza vacío, basura y percent-encoding roto', () => {
    expect(parseJoinUrl('', { debug: false })).toEqual({ ok: false, error: 'vacio' });
    expect(parseJoinUrl('hola', { debug: false })).toEqual({ ok: false, error: 'formato' });
    expect(parseJoinUrl('https://vr.lexodive.com/app/#s=%E0%A4%A&t=x', { debug: false })).toEqual({ ok: false, error: 'formato' });
  });

  it('permite cambiar los hosts permitidos', () => {
    const r = parseJoinUrl(`https://otro.com/app/#s=${S}&t=x`, { debug: false, hostsPermitidos: ['otro.com'] });
    expect(r.ok).toBe(true);
  });
});
