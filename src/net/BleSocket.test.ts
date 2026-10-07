import { BleSocket, AdaptadorBle } from './BleSocket';
import { ExtClient } from './ExtClient';

class RadioFalsa implements AdaptadorBle {
  escritos: string[] = [];
  mtu = 23;
  falla = false;
  desconectado = false;
  alRecibir: (t: string) => void = () => {};
  alDesconectar: () => void = () => {};
  async conectar(_id: string, r: (t: string) => void, d: () => void) {
    if (this.falla) throw new Error('no conecta');
    this.alRecibir = r;
    this.alDesconectar = d;
    return { mtu: this.mtu };
  }
  async escribir(t: string) {
    this.escritos.push(t);
  }
  async desconectar() {
    this.desconectado = true;
  }
  lineas() {
    return this.escritos.join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
}

const ROBOT = { id: 'AA:BB', nombre: 'Lexo-01' };
const libre = () => new Promise<void>((r) => setImmediate(r));

function crear() {
  const radio = new RadioFalsa();
  const ext = new ExtClient({ url: 'ble://AA:BB', token: '', deviceId: 'd', canal: 'ble', crearWebSocket: () => new BleSocket(radio, ROBOT) });
  return { radio, ext };
}

describe('BleSocket', () => {
  it('contesta EXT_HELLO con un EXT_READY local y no se lo manda al robot', async () => {
    const { radio, ext } = crear();
    ext.conectar();
    await new Promise((r) => setTimeout(r, 10));
    expect(ext.getSnapshot().estado).toBe('conectado');
    expect(ext.getSnapshot().robot).toMatchObject({ id: 'AA:BB', name: 'Lexo-01' });
    expect(radio.escritos).toEqual([]);
    ext.destruir();
  });

  it('manda los comandos con el mismo JSON, una línea por paquete, troceado según el MTU', async () => {
    const { radio, ext } = crear();
    ext.conectar();
    await new Promise((r) => setTimeout(r, 10));
    ext.setBoton('adelante', true);
    await new Promise((r) => setTimeout(r, 10));
    expect(radio.escritos.length).toBeGreaterThan(1); // MTU 23 → trozos de 20 bytes
    expect(radio.escritos.every((t) => t.length <= 20)).toBe(true);
    expect(radio.lineas()[0]).toEqual({ protocol: 'R26', version: 1, type: 'ROBOT_COMMAND', robotId: 'AA:BB', traction: 70, steering: 0 });
    ext.destruir();
  });

  it('con MTU alto cada paquete va en una sola escritura', async () => {
    const { radio, ext } = crear();
    radio.mtu = 247;
    ext.conectar();
    await new Promise((r) => setTimeout(r, 10));
    ext.setHeliceMovimiento(60);
    await new Promise((r) => setTimeout(r, 10));
    expect(radio.escritos).toHaveLength(1);
    expect(radio.escritos[0].endsWith('\n')).toBe(true);
    expect(radio.lineas()[0]).toMatchObject({ type: 'ROBOT_SET', helice: 60 });
    ext.destruir();
  });

  it('junta lo que el robot manda partido y entrega una línea por mensaje', async () => {
    const radio = new RadioFalsa();
    const ws = new BleSocket(radio, ROBOT);
    const recibidos: string[] = [];
    ws.onmessage = (e) => recibidos.push(String(e.data));
    await libre();
    radio.alRecibir('{"type":"ERR');
    radio.alRecibir('OR","message":"x"}\n{"type":"PONG"}\n');
    expect(recibidos).toEqual(['{"type":"ERROR","message":"x"}', '{"type":"PONG"}']);
  });

  it('descarta el ROBOT_COMMAND viejo si todavía no salió', async () => {
    const radio = new RadioFalsa();
    radio.mtu = 247;
    const ws = new BleSocket(radio, ROBOT);
    ws.onopen = () => {};
    await libre();
    const cmd = (t: number) => JSON.stringify({ type: 'ROBOT_COMMAND', robotId: 'x', traction: t, steering: 0 });
    ws.send(cmd(10)); // sale enseguida
    ws.send(cmd(20)); // queda en cola
    ws.send(cmd(30)); // reemplaza al 20
    await libre();
    await libre();
    expect(radio.lineas().map((l) => l.traction)).toEqual([10, 30]);
  });

  it('si no puede conectar, cierra y ExtClient informa el fin por Bluetooth', async () => {
    const radio = new RadioFalsa();
    radio.falla = true;
    const ext = new ExtClient({ url: 'ble://x', token: '', deviceId: 'd', canal: 'ble', crearWebSocket: () => new BleSocket(radio, ROBOT) });
    ext.conectar();
    await libre();
    expect(ext.getSnapshot().fin?.codigo).toBe('ble_sin_conexion');
  });

  it('si el enlace se corta ya conectado, ExtClient pasa a reconectando', async () => {
    const { radio, ext } = crear();
    ext.conectar();
    await new Promise((r) => setTimeout(r, 10));
    expect(ext.getSnapshot().estado).toBe('conectado');
    radio.alDesconectar();
    expect(ext.getSnapshot().estado).toBe('reconectando');
    ext.destruir();
  });

  it('al cerrar vacía la cola antes de desconectar', async () => {
    const radio = new RadioFalsa();
    radio.mtu = 247;
    const ws = new BleSocket(radio, ROBOT);
    await libre();
    ws.send(JSON.stringify({ type: 'ROBOT_COMMAND', robotId: 'x', traction: 0, steering: 0 }));
    ws.close();
    await libre();
    await libre();
    expect(radio.lineas()).toHaveLength(1);
    expect(radio.desconectado).toBe(true);
  });
});
