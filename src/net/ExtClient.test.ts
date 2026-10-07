import { ExtClient, WebSocketLike, clasificarErrorFatal } from './ExtClient';

class WsFalso implements WebSocketLike {
  static todos: WsFalso[] = [];
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  enviados: any[] = [];
  cerrado = false;
  constructor(public url: string) {
    WsFalso.todos.push(this);
  }
  send(data: string) {
    this.enviados.push(JSON.parse(data));
  }
  close() {
    this.cerrado = true;
  }
  // utilidades de test
  abrir() {
    this.onopen?.();
  }
  recibir(obj: object) {
    this.onmessage?.({ data: JSON.stringify({ protocol: 'R26', version: 1, ...obj }) });
  }
  caer() {
    this.onclose?.();
  }
  tipos(tipo: string) {
    return this.enviados.filter((m) => m.type === tipo);
  }
}

const READY = (id = 'robot-02') => ({
  type: 'EXT_READY',
  spawned: { id, name: 'Ana', color: '#1c7ed6', slot: 2, adopted: false, nameRejected: false },
});

function crear(name?: string) {
  const c = new ExtClient({
    url: 'wss://x/ws',
    token: 'TOK',
    deviceId: 'dev-1',
    name,
    crearWebSocket: (u) => new WsFalso(u),
  });
  c.conectar();
  const ws = () => WsFalso.todos[WsFalso.todos.length - 1];
  return { c, ws };
}

function conectado(name?: string) {
  const r = crear(name);
  r.ws().abrir();
  r.ws().recibir(READY());
  return r;
}

beforeEach(() => {
  WsFalso.todos = [];
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('ExtClient sin conectar', () => {
  it('pausar y reanudar no abren ningún socket si nunca se llamó a conectar()', () => {
    const c = new ExtClient({ url: '', token: '', deviceId: 'd', crearWebSocket: (u) => new WsFalso(u) });
    c.pausar();
    c.reanudar();
    expect(WsFalso.todos).toHaveLength(0);
    expect(c.getSnapshot().estado).toBe('inactivo');
  });
});

describe('ExtClient', () => {
  it('manda EXT_HELLO al abrir y pasa a conectado con EXT_READY', () => {
    const { c, ws } = crear('Ana');
    expect(c.getSnapshot().estado).toBe('conectando');
    ws().abrir();
    expect(ws().enviados[0]).toEqual({
      protocol: 'R26',
      version: 1,
      type: 'EXT_HELLO',
      token: 'TOK',
      hz: 2,
      watchdogMs: 300,
      deviceId: 'dev-1',
      spawn: { name: 'Ana' },
    });
    ws().recibir(READY());
    expect(c.getSnapshot().estado).toBe('conectado');
    expect(c.getSnapshot().robot?.id).toBe('robot-02');
  });

  it('con el nombre vacío no manda name', () => {
    const { ws } = crear('   ');
    ws().abrir();
    expect(ws().enviados[0].spawn).toEqual({});
  });

  it('manda comandos a 20 Hz mientras hay un botón y UN cero al soltar', () => {
    const { c, ws } = conectado();
    c.setBoton('adelante', true);
    c.setBoton('derecha', true);
    ws().enviados.length = 0;
    jest.advanceTimersByTime(1000);
    const cmds = ws().tipos('ROBOT_COMMAND');
    expect(cmds.length).toBe(20);
    expect(cmds[0]).toMatchObject({ robotId: 'robot-02', traction: 70, steering: 70 });
    c.setBoton('adelante', false);
    c.setBoton('derecha', false);
    const despues = ws().tipos('ROBOT_COMMAND').slice(20);
    expect(despues.at(-1)).toMatchObject({ traction: 0, steering: 0 });
    ws().enviados.length = 0;
    jest.advanceTimersByTime(1000);
    expect(ws().tipos('ROBOT_COMMAND')).toHaveLength(0); // ya no manda nada
  });

  it('adelante + atrás suma cero, atrás es negativo e izquierda negativa', () => {
    const { c, ws } = conectado();
    c.setBoton('atras', true);
    c.setBoton('izquierda', true);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: -70, steering: -70 });
    c.setBoton('adelante', true);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 0, steering: -70 });
  });

  it('la inclinación manda comandos, se suma a los botones y suelta con un cero', () => {
    const { c, ws } = conectado();
    c.setInclinacion(40, -20);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 40, steering: -20 });
    ws().enviados.length = 0;
    jest.advanceTimersByTime(100);
    expect(ws().tipos('ROBOT_COMMAND').length).toBe(2); // se reenvía cada 50 ms
    c.setBoton('adelante', true);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 100, steering: -20 }); // 70 + 40, recortado
    c.setBoton('adelante', false);
    c.setInclinacion(0, 0);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 0, steering: 0 });
    ws().enviados.length = 0;
    jest.advanceTimersByTime(500);
    expect(ws().tipos('ROBOT_COMMAND')).toHaveLength(0);
  });

  it('volar: helice 100 al apretar y 0 al soltar', () => {
    const { c, ws } = conectado();
    c.setBoton('volar', true);
    c.setBoton('volar', false);
    expect(ws().tipos('ROBOT_SET').map((m) => m.helice)).toEqual([100, 0]);
  });

  it('la hélice por movimiento es proporcional, convive con el botón y baja a 0', () => {
    const { c, ws } = conectado();
    c.setHeliceMovimiento(40);
    c.setHeliceMovimiento(40); // repetido: no manda nada
    c.setHeliceMovimiento(80);
    expect(ws().tipos('ROBOT_SET').map((m) => m.helice)).toEqual([40, 80]);

    c.setBoton('volar', true); // el botón da 100: manda el mayor
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(100);
    c.setHeliceMovimiento(0);
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(100); // sigue encendida por el botón
    c.setBoton('volar', false);
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(0);
  });

  it('la hélice por movimiento recorta a 0..100 y se apaga al soltar todo', () => {
    const { c, ws } = conectado();
    c.setHeliceMovimiento(250);
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(100);
    c.soltarTodo();
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(0);
  });

  it('manda PING cada 5 s y mide el ping con el PONG', () => {
    const { c, ws } = conectado();
    expect(ws().tipos('PING')).toHaveLength(1);
    jest.advanceTimersByTime(5000);
    expect(ws().tipos('PING')).toHaveLength(2);
    jest.advanceTimersByTime(40);
    ws().recibir({ type: 'PONG' });
    expect(c.getSnapshot().pingMs).toBe(40);
  });

  it('ignora EXT_STATE y tipos desconocidos; un ERROR posterior al READY es solo un aviso', () => {
    const { c, ws } = conectado();
    ws().recibir({ type: 'EXT_STATE', x: 1 });
    ws().recibir({ type: 'RARO' });
    expect(c.getSnapshot().estado).toBe('conectado');
    ws().recibir({ type: 'ERROR', message: 'demasiados mensajes por segundo' });
    expect(c.getSnapshot().estado).toBe('conectado');
    expect(c.getSnapshot().aviso?.texto).toBe('demasiados mensajes por segundo');
  });

  it('reconecta con backoff 1, 2, 4, 8, 8 s con el mismo deviceId y token', () => {
    const { c, ws } = conectado('Ana');
    const esperas = [1000, 2000, 4000, 8000, 8000];
    for (const e of esperas) {
      const n = WsFalso.todos.length;
      ws().caer();
      expect(c.getSnapshot().estado).toBe('reconectando');
      jest.advanceTimersByTime(e - 1);
      expect(WsFalso.todos.length).toBe(n); // todavía no
      jest.advanceTimersByTime(1);
      expect(WsFalso.todos.length).toBe(n + 1);
      ws().abrir();
      expect(ws().enviados[0]).toMatchObject({ type: 'EXT_HELLO', deviceId: 'dev-1', token: 'TOK', spawn: { name: 'Ana' } });
      // el reintento también se cae antes del READY: el backoff sigue creciendo
    }
  });

  it('al lograr el READY tras un corte, el backoff vuelve a empezar y conserva el robot', () => {
    const { c, ws } = conectado();
    ws().caer();
    jest.advanceTimersByTime(1000);
    ws().abrir();
    ws().recibir(READY('robot-02'));
    expect(c.getSnapshot().estado).toBe('conectado');
    expect(c.getSnapshot().robot?.id).toBe('robot-02');
    const n = WsFalso.todos.length;
    ws().caer();
    jest.advanceTimersByTime(1000);
    expect(WsFalso.todos.length).toBe(n + 1);
  });

  it('EXT_CLOSED no reconecta y borra el token (salvo expulsión)', () => {
    const a = conectado();
    a.ws().recibir({ type: 'EXT_CLOSED', reason: 'el docente regeneró el QR' });
    expect(a.c.getSnapshot().estado).toBe('terminado');
    expect(a.c.getSnapshot().fin).toMatchObject({ codigo: 'cerrado_servidor', borrarToken: true });
    a.ws().caer();
    jest.advanceTimersByTime(60000);
    expect(WsFalso.todos.length).toBe(1);

    WsFalso.todos = [];
    const b = conectado();
    b.ws().recibir({ type: 'EXT_CLOSED', reason: 'el docente te sacó de la clase' });
    expect(b.c.getSnapshot().fin).toMatchObject({ codigo: 'expulsado', borrarToken: false });
  });

  it('ERROR antes del READY es fatal y no reconecta', () => {
    const { c, ws } = crear();
    ws().abrir();
    ws().recibir({ type: 'ERROR', message: 'token_revoked: regenerado' });
    expect(c.getSnapshot().fin).toMatchObject({ codigo: 'token_revocado', borrarToken: true });
    jest.advanceTimersByTime(60000);
    expect(WsFalso.todos.length).toBe(1);
  });

  it('si la primera conexión falla no reintenta: avisa sin conexión', () => {
    const { c, ws } = crear();
    ws().caer();
    expect(c.getSnapshot().fin).toMatchObject({ codigo: 'sin_conexion', borrarToken: false });
    jest.advanceTimersByTime(60000);
    expect(WsFalso.todos.length).toBe(1);
  });

  it('sin EXT_READY en 12 s corta la conexión', () => {
    const { c, ws } = crear();
    ws().abrir();
    jest.advanceTimersByTime(12000);
    expect(c.getSnapshot().fin?.codigo).toBe('sin_respuesta');
    expect(ws().cerrado).toBe(true);
  });

  it('salir manda EXT_LEAVE, cierra y no borra el token', () => {
    const { c, ws } = conectado();
    const sock = ws();
    c.salir();
    expect(sock.tipos('EXT_LEAVE')).toHaveLength(1);
    expect(sock.cerrado).toBe(true);
    expect(c.getSnapshot().fin).toMatchObject({ codigo: 'salio', borrarToken: false });
  });

  it('segundo plano: suelta todo, manda cero, cierra; al volver reconecta con el mismo deviceId', () => {
    const { c, ws } = conectado();
    const primero = ws();
    c.setBoton('adelante', true);
    c.setBoton('volar', true);
    c.pausar();
    expect(primero.tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 0, steering: 0 });
    expect(primero.tipos('ROBOT_SET').at(-1).helice).toBe(0);
    expect(primero.cerrado).toBe(true);
    jest.advanceTimersByTime(60000);
    expect(WsFalso.todos.length).toBe(1); // no reintenta en segundo plano
    c.reanudar();
    expect(WsFalso.todos.length).toBe(2);
    ws().abrir();
    expect(ws().enviados[0]).toMatchObject({ type: 'EXT_HELLO', deviceId: 'dev-1' });
  });
});

describe('clasificarErrorFatal', () => {
  it.each([
    ['token_revoked: x', 'token_revocado', true],
    ['EXT_HELLO: token vencido', 'token_invalido', true],
    ['EXT_HELLO.spawn: el aula está llena', 'aula_llena', false],
    ['el modo celulares no está activado', 'modo_apagado', false],
    ['la conexión remota no está activada', 'modo_apagado', false],
    ['el simulador no está publicando datos', 'simulador_no_responde', false],
    ['no pudo crear el robot', 'simulador_no_responde', false],
    ['demasiadas conexiones externas', 'aula_llena', false],
    ['cualquier cosa', 'error_servidor', false],
  ])('%s', (msg, codigo, borrar) => {
    expect(clasificarErrorFatal(msg)).toMatchObject({ codigo, borrarToken: borrar });
  });
});

describe('ExtClient: hélice en el estado observable', () => {
  beforeEach(() => {
    WsFalso.todos = [];
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('el snapshot refleja la hélice pedida, también sin conexión', () => {
    const { c, ws } = conectado();
    expect(c.getSnapshot().helice).toBe(0);
    c.setHeliceMovimiento(60);
    expect(c.getSnapshot().helice).toBe(60);
    c.setBoton('volar', true);
    expect(c.getSnapshot().helice).toBe(100);
    ws().caer(); // se corta la red: sigue mostrando lo que pide el usuario
    expect(c.getSnapshot().helice).toBe(100);
    c.setBoton('volar', false);
    expect(c.getSnapshot().helice).toBe(60); // queda la del movimiento
    c.setHeliceMovimiento(0);
    expect(c.getSnapshot().helice).toBe(0);
  });

  it('sin conexión (ni EXT_READY) igual actualiza la hélice pedida y no manda nada', () => {
    const { c, ws } = crear();
    c.setHeliceMovimiento(70);
    expect(c.getSnapshot().helice).toBe(70);
    expect(ws().enviados).toHaveLength(0);
    ws().abrir();
    ws().recibir(READY());
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(70); // al conectar se manda lo pendiente
  });
});

describe('ExtClient: botón STOP', () => {
  beforeEach(() => {
    WsFalso.todos = [];
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('STOP frena aunque haya otros botones o inclinación, y mientras está apretado manda ceros', () => {
    const { c, ws } = conectado();
    c.setBoton('adelante', true);
    c.setInclinacion(0, 40);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 70, steering: 40 });

    c.setBoton('stop', true);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 0, steering: 0 });
    ws().enviados.length = 0;
    jest.advanceTimersByTime(200);
    const cmds = ws().tipos('ROBOT_COMMAND');
    expect(cmds.length).toBe(4); // sigue mandando ceros cada 50 ms
    expect(cmds.every((m) => m.traction === 0 && m.steering === 0)).toBe(true);

    c.setBoton('stop', false); // al soltar vuelve a valer lo que siga apretado
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 70, steering: 40 });
  });

  it('STOP solo, apretado y soltado, deja un cero y después no manda nada', () => {
    const { c, ws } = conectado();
    c.setBoton('stop', true);
    c.setBoton('stop', false);
    expect(ws().tipos('ROBOT_COMMAND').at(-1)).toMatchObject({ traction: 0, steering: 0 });
    ws().enviados.length = 0;
    jest.advanceTimersByTime(500);
    expect(ws().tipos('ROBOT_COMMAND')).toHaveLength(0);
  });

  it('STOP no apaga la hélice', () => {
    const { c, ws } = conectado();
    c.setBoton('volar', true);
    c.setBoton('stop', true);
    expect(ws().tipos('ROBOT_SET').at(-1).helice).toBe(100);
  });
});

describe('ExtClient: LED, espada láser y buzzer', () => {
  beforeEach(() => {
    WsFalso.todos = [];
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  /** Mensajes ROBOT_SET que traen el campo `campo` (para no mezclar con la hélice). */
  const con = (ws: WsFalso, campo: string) => ws.tipos('ROBOT_SET').filter((m) => campo in m);

  it('el LED se prende y se apaga, un campo por mensaje', () => {
    const { c, ws } = conectado();
    c.alternarLed();
    expect(con(ws(), 'led').at(-1)).toMatchObject({ robotId: 'robot-02', led: true });
    expect(Object.keys(con(ws(), 'led').at(-1)).sort()).toEqual(['led', 'protocol', 'robotId', 'type', 'version']);
    expect(c.getSnapshot().led).toBe(true);
    c.alternarLed();
    expect(con(ws(), 'led').map((m) => m.led)).toEqual([true, false]);
    expect(c.getSnapshot().led).toBe(false);
  });

  it('la espada láser se activa y se desactiva con el campo sword', () => {
    const { c, ws } = conectado();
    c.alternarEspada();
    c.alternarEspada();
    expect(con(ws(), 'sword').map((m) => m.sword)).toEqual([true, false]);
  });

  it('el buzzer suena 1 segundo y se apaga solo', () => {
    const { c, ws } = conectado();
    c.sonarBuzzer();
    expect(con(ws(), 'buzzer').map((m) => m.buzzer)).toEqual([true]);
    expect(c.getSnapshot().buzzer).toBe(true);
    jest.advanceTimersByTime(999);
    expect(con(ws(), 'buzzer')).toHaveLength(1); // todavía suena
    jest.advanceTimersByTime(1);
    expect(con(ws(), 'buzzer').map((m) => m.buzzer)).toEqual([true, false]);
    expect(c.getSnapshot().buzzer).toBe(false);
  });

  it('apretar el buzzer de nuevo mientras suena extiende el tiempo, sin mandar un apagado de más', () => {
    const { c, ws } = conectado();
    c.sonarBuzzer();
    jest.advanceTimersByTime(600);
    c.sonarBuzzer();
    jest.advanceTimersByTime(600); // 1200 ms desde el primero, pero solo 600 desde el segundo
    expect(con(ws(), 'buzzer').map((m) => m.buzzer)).toEqual([true]);
    jest.advanceTimersByTime(400);
    expect(con(ws(), 'buzzer').map((m) => m.buzzer)).toEqual([true, false]);
  });

  it('lo pedido sin conexión se manda al conectar, y se vuelve a mandar tras reconectar', () => {
    const { c, ws } = crear();
    c.alternarLed();
    c.alternarEspada();
    expect(c.getSnapshot()).toMatchObject({ led: true, espada: true });
    expect(ws().enviados).toHaveLength(0);
    ws().abrir();
    ws().recibir(READY());
    expect(con(ws(), 'led').at(-1).led).toBe(true);
    expect(con(ws(), 'sword').at(-1).sword).toBe(true);

    ws().caer();
    jest.advanceTimersByTime(1000);
    ws().abrir();
    ws().recibir(READY('robot-05')); // robot nuevo
    expect(con(ws(), 'led').at(-1)).toMatchObject({ robotId: 'robot-05', led: true });
    expect(con(ws(), 'sword').at(-1)).toMatchObject({ robotId: 'robot-05', sword: true });
  });

  it('al soltar todo (segundo plano) el buzzer se apaga, pero el LED y la espada quedan', () => {
    const { c, ws } = conectado();
    c.alternarLed();
    c.sonarBuzzer();
    c.soltarTodo();
    expect(con(ws(), 'buzzer').map((m) => m.buzzer)).toEqual([true, false]);
    expect(c.getSnapshot()).toMatchObject({ led: true, buzzer: false });
    jest.advanceTimersByTime(2000);
    expect(con(ws(), 'buzzer')).toHaveLength(2); // el timer ya no manda nada
  });

  it('no manda mensajes de más: el estado repetido no genera tráfico', () => {
    const { c, ws } = conectado();
    ws().enviados.length = 0;
    c.soltarTodo();
    c.soltarTodo();
    expect(ws().tipos('ROBOT_SET')).toHaveLength(0);
  });
});
