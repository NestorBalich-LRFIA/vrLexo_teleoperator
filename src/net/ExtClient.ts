import {
  BACKOFF_MS,
  HELICE_ON,
  HELLO_TIMEOUT_MS,
  HZ_ESTADO,
  INTERVALO_ENVIO_MS,
  MAX_NOMBRE,
  PING_INTERVALO_MS,
  SPEED,
  WATCHDOG_MS,
} from '../config';

const PROTO = { protocol: 'R26', version: 1 } as const;

export type Boton = 'adelante' | 'atras' | 'izquierda' | 'derecha' | 'volar' | 'stop';

export type EstadoConexion = 'inactivo' | 'conectando' | 'conectado' | 'reconectando' | 'terminado';

export type CodigoFin =
  | 'token_revocado'
  | 'token_invalido'
  | 'aula_llena'
  | 'modo_apagado'
  | 'simulador_no_responde'
  | 'error_servidor'
  | 'cerrado_servidor'
  | 'expulsado'
  | 'sin_conexion'
  | 'sin_respuesta'
  | 'salio';

export interface Fin {
  codigo: CodigoFin;
  /** Texto del servidor (ERROR.message o EXT_CLOSED.reason), si lo hay. */
  texto?: string;
  /** Si la app debe olvidar el token guardado. */
  borrarToken: boolean;
}

export interface Robot {
  id: string;
  name: string;
  color: string;
  slot: number;
  adopted: boolean;
  nameRejected: boolean;
}

export interface Aviso {
  id: number;
  texto: string;
}

export interface Snapshot {
  estado: EstadoConexion;
  robot: Robot | null;
  pingMs: number | null;
  fin: Fin | null;
  /** Aviso corto (toast) no fatal. */
  aviso: Aviso | null;
  /** Hélice (0..100) que pide el usuario (botón Volar o movimiento), conectado o no; sirve para la barra de altura. */
  helice: number;
}

/** Lo mínimo que se usa del WebSocket de React Native (permite inyectar uno falso en los tests). */
export interface WebSocketLike {
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface OpcionesExtClient {
  url: string;
  token: string;
  deviceId: string;
  /** Nombre pedido (se omite si está vacío). */
  name?: string;
  crearWebSocket?: (url: string) => WebSocketLike;
}

type Oyente = () => void;

/** Límite del protocolo: −100..100 (y sin −0). */
const recortar = (v: number): number => Math.max(-100, Math.min(100, v)) || 0;

/** Convierte el texto de un ERROR previo a EXT_READY en el motivo de fin que muestra la app. */
export function clasificarErrorFatal(msg: string): Fin {
  const m = msg ?? '';
  if (m.startsWith('token_revoked:')) return { codigo: 'token_revocado', texto: m, borrarToken: true };
  if (m.startsWith('EXT_HELLO.spawn:') && m.includes('llena')) return { codigo: 'aula_llena', texto: m, borrarToken: false };
  if (m.includes('modo celulares no está activado') || m.includes('conexión remota no está activada'))
    return { codigo: 'modo_apagado', texto: m, borrarToken: false };
  if (m.includes('no está publicando datos') || m.includes('no pudo crear el robot'))
    return { codigo: 'simulador_no_responde', texto: m, borrarToken: false };
  if (m.includes('demasiadas conexiones externas')) return { codigo: 'aula_llena', texto: m, borrarToken: false };
  if (m.startsWith('EXT_HELLO:')) return { codigo: 'token_invalido', texto: m, borrarToken: true };
  return { codigo: 'error_servidor', texto: m, borrarToken: false };
}

/**
 * Conexión con el servidor del simulador (protocolo EXT_*). No depende de React:
 * el estado de los botones vive acá y un setInterval reenvía los comandos.
 */
export class ExtClient {
  private readonly opc: OpcionesExtClient;
  private ws: WebSocketLike | null = null;
  private snap: Snapshot = { estado: 'inactivo', robot: null, pingMs: null, fin: null, aviso: null, helice: 0 };
  private readonly oyentes = new Set<Oyente>();

  private botones: Record<Boton, boolean> = { adelante: false, atras: false, izquierda: false, derecha: false, volar: false, stop: false };
  private inclTraccion = 0;
  private inclGiro = 0;
  private heliceMovimiento = 0;
  private heliceEnviada = 0;
  private hayDireccion = false;
  private ceroPendiente = false;

  private listo = false;
  private huboListo = false;
  private pausado = false;
  private terminado = false;
  private intento = 0;
  private avisoId = 0;
  private pingEnviadoEn = 0;

  private timerHello: ReturnType<typeof setTimeout> | null = null;
  private timerReintento: ReturnType<typeof setTimeout> | null = null;
  private timerEnvio: ReturnType<typeof setInterval> | null = null;
  private timerPing: ReturnType<typeof setInterval> | null = null;

  constructor(opc: OpcionesExtClient) {
    this.opc = opc;
  }

  // ---- estado observable (compatible con useSyncExternalStore) ----

  subscribe = (oyente: Oyente): (() => void) => {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  };

  getSnapshot = (): Snapshot => this.snap;

  private actualizar(parcial: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...parcial };
    this.oyentes.forEach((o) => o());
  }

  // ---- ciclo de vida ----

  conectar() {
    if (this.terminado || this.ws) return;
    this.pausado = false;
    this.abrir();
  }

  /** La app pasó a segundo plano: soltar todo, cero, y cerrar el socket sin EXT_LEAVE (el robot espera la gracia). */
  pausar() {
    if (this.terminado || this.pausado) return;
    this.soltarTodo();
    this.pausado = true;
    this.limpiarTimers();
    this.cerrarSocket();
    this.listo = false;
    this.actualizar({ estado: 'inactivo', pingMs: null });
  }

  /** Volvió al primer plano: reconectar con el mismo deviceId. */
  reanudar() {
    if (this.terminado || !this.pausado) return;
    this.pausado = false;
    this.intento = 0;
    this.abrir();
  }

  /** Botón "Desconectar": EXT_LEAVE + cerrar. El token sigue valiendo. */
  salir() {
    if (this.terminado) return;
    this.soltarTodo();
    if (this.listo) this.enviar({ type: 'EXT_LEAVE' });
    this.terminar({ codigo: 'salio', borrarToken: false });
  }

  /** Cierra todo sin avisar al servidor (al desmontar la pantalla). */
  destruir() {
    this.terminado = true;
    this.limpiarTimers();
    this.cerrarSocket();
    this.listo = false;
    this.oyentes.clear();
  }

  // ---- entrada del usuario ----

  setBoton(boton: Boton, apretado: boolean) {
    if (this.terminado || this.botones[boton] === apretado) return;
    this.botones[boton] = apretado;
    if (boton === 'volar') {
      this.sincronizarHelice();
      return;
    }
    this.recalcularDireccion();
  }

  /** Movimiento por inclinación del celular (−100..100); se suma a los botones. 0,0 = nada. */
  setInclinacion(traction: number, steering: number) {
    if (this.terminado || (this.inclTraccion === traction && this.inclGiro === steering)) return;
    this.inclTraccion = traction;
    this.inclGiro = steering;
    this.recalcularDireccion();
  }

  private recalcularDireccion() {
    const b = this.botones;
    // STOP apretado cuenta como "hay dirección": se siguen mandando ceros cada 50 ms aunque haya otros botones o inclinación.
    const hay = b.stop || b.adelante || b.atras || b.izquierda || b.derecha || this.inclTraccion !== 0 || this.inclGiro !== 0;
    const habia = this.hayDireccion;
    this.hayDireccion = hay;
    if (hay) {
      this.enviarComando();
    } else if (habia) {
      this.enviarCero();
    }
  }

  /** Hélice por movimiento del celular (0..100). Convive con el botón Volar: manda el mayor de los dos. */
  setHeliceMovimiento(nivel: number) {
    if (this.terminado) return;
    const n = Math.max(0, Math.min(100, Math.round(nivel))) || 0;
    if (n === this.heliceMovimiento) return;
    this.heliceMovimiento = n;
    this.sincronizarHelice();
  }

  /** Suelta todos los botones y apaga la hélice (mandando el cero si hacía falta). */
  soltarTodo() {
    const habia = this.hayDireccion;
    this.botones = { adelante: false, atras: false, izquierda: false, derecha: false, volar: false, stop: false };
    this.inclTraccion = 0;
    this.inclGiro = 0;
    this.hayDireccion = false;
    this.heliceMovimiento = 0;
    if (habia) this.enviarCero();
    this.sincronizarHelice();
  }

  // ---- conexión ----

  private abrir() {
    const crear = this.opc.crearWebSocket ?? ((u: string) => new WebSocket(u) as unknown as WebSocketLike);
    this.actualizar({ estado: this.huboListo ? 'reconectando' : 'conectando' });
    let ws: WebSocketLike;
    try {
      ws = crear(this.opc.url);
    } catch {
      this.alCaer('sin_conexion');
      return;
    }
    this.ws = ws;
    this.listo = false;
    this.timerHello = setTimeout(() => {
      this.timerHello = null;
      if (this.ws === ws && !this.listo) {
        this.cerrarSocket();
        this.alCaer('sin_respuesta');
      }
    }, HELLO_TIMEOUT_MS);
    ws.onopen = () => {
      if (this.ws === ws) this.enviarHello();
    };
    ws.onmessage = (ev) => {
      if (this.ws === ws) this.alMensaje(ev.data);
    };
    ws.onerror = () => {
      /* el onclose posterior maneja la caída */
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.alCaer('sin_conexion');
    };
  }

  private enviarHello() {
    const nombre = (this.opc.name ?? '').trim().slice(0, MAX_NOMBRE);
    this.enviar({
      type: 'EXT_HELLO',
      token: this.opc.token,
      hz: HZ_ESTADO,
      watchdogMs: WATCHDOG_MS,
      deviceId: this.opc.deviceId,
      spawn: nombre ? { name: nombre } : {},
    });
  }

  private alMensaje(data: unknown) {
    if (typeof data !== 'string') return;
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'EXT_READY':
        return this.alListo(msg);
      case 'PONG':
        if (this.pingEnviadoEn) {
          this.actualizar({ pingMs: Math.max(0, Date.now() - this.pingEnviadoEn) });
          this.pingEnviadoEn = 0;
        }
        return;
      case 'ERROR': {
        const texto = String(msg.message ?? '');
        if (!this.listo) return this.terminar(clasificarErrorFatal(texto));
        this.actualizar({ aviso: { id: ++this.avisoId, texto } });
        return;
      }
      case 'EXT_CLOSED': {
        const reason = String(msg.reason ?? '');
        const expulsado = reason.includes('te sacó');
        return this.terminar({
          codigo: expulsado ? 'expulsado' : 'cerrado_servidor',
          texto: reason,
          borrarToken: !expulsado,
        });
      }
      default:
        return; // EXT_STATE y cualquier otro: se ignora
    }
  }

  private alListo(msg: any) {
    const sp = msg.spawned;
    if (!sp || typeof sp.id !== 'string') {
      return this.terminar({ codigo: 'error_servidor', texto: 'EXT_READY sin spawned', borrarToken: false });
    }
    if (this.timerHello) {
      clearTimeout(this.timerHello);
      this.timerHello = null;
    }
    const robot: Robot = {
      id: sp.id,
      name: String(sp.name ?? ''),
      color: typeof sp.color === 'string' ? sp.color : '#1c7ed6',
      slot: Number(sp.slot) || 0,
      adopted: !!sp.adopted,
      nameRejected: !!sp.nameRejected,
    };
    this.listo = true;
    this.huboListo = true;
    this.intento = 0;
    this.heliceEnviada = 0;
    this.actualizar({ estado: 'conectado', robot, fin: null });
    this.iniciarTimers();
    if (this.ceroPendiente) this.enviarCero();
    if (this.hayDireccion) this.enviarComando();
    this.sincronizarHelice();
  }

  /** El socket se perdió sin EXT_CLOSED ni ERROR: reconectar con backoff si ya habíamos estado conectados. */
  private alCaer(codigo: 'sin_conexion' | 'sin_respuesta') {
    if (this.terminado || this.pausado) return;
    this.limpiarTimers();
    this.listo = false;
    if (!this.huboListo) {
      return this.terminar({ codigo, borrarToken: false });
    }
    const espera = BACKOFF_MS[Math.min(this.intento, BACKOFF_MS.length - 1)];
    this.intento++;
    this.actualizar({ estado: 'reconectando', pingMs: null });
    this.timerReintento = setTimeout(() => {
      this.timerReintento = null;
      if (!this.terminado && !this.pausado) this.abrir();
    }, espera);
  }

  private terminar(fin: Fin) {
    if (this.terminado) return;
    this.terminado = true;
    this.limpiarTimers();
    this.cerrarSocket();
    this.listo = false;
    this.actualizar({ estado: 'terminado', fin, pingMs: null });
  }

  private cerrarSocket() {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close(1000);
    } catch {
      /* ya estaba cerrado */
    }
  }

  // ---- envío ----

  private enviar(obj: Record<string, unknown>) {
    if (!this.ws) return;
    try {
      this.ws.send(JSON.stringify({ ...PROTO, ...obj }));
    } catch {
      /* si el socket se cayó, onclose lo maneja */
    }
  }

  private traccion(): number {
    if (this.botones.stop) return 0;
    return recortar((this.botones.adelante ? SPEED : 0) - (this.botones.atras ? SPEED : 0) + this.inclTraccion);
  }

  private giro(): number {
    if (this.botones.stop) return 0;
    return recortar((this.botones.derecha ? SPEED : 0) - (this.botones.izquierda ? SPEED : 0) + this.inclGiro);
  }

  private enviarComando() {
    if (!this.listo || !this.snap.robot) return;
    this.enviar({ type: 'ROBOT_COMMAND', robotId: this.snap.robot.id, traction: this.traccion(), steering: this.giro() });
  }

  /** UN comando en cero al soltar todo (o al reconectar si se soltó sin conexión). */
  private enviarCero() {
    if (!this.listo || !this.snap.robot) {
      this.ceroPendiente = true;
      return;
    }
    this.ceroPendiente = false;
    this.enviar({ type: 'ROBOT_COMMAND', robotId: this.snap.robot.id, traction: 0, steering: 0 });
  }

  private sincronizarHelice() {
    const deseada = Math.max(this.botones.volar ? HELICE_ON : 0, this.heliceMovimiento);
    // El estado observable muestra la hélice pedida (aunque no haya conexión): alimenta la barra de altura.
    if (deseada !== this.snap.helice) this.actualizar({ helice: deseada });
    if (!this.listo || !this.snap.robot || deseada === this.heliceEnviada) return;
    this.heliceEnviada = deseada;
    this.enviar({ type: 'ROBOT_SET', robotId: this.snap.robot.id, helice: deseada });
  }

  private iniciarTimers() {
    this.limpiarTimers();
    this.timerEnvio = setInterval(() => {
      if (this.hayDireccion) this.enviarComando();
    }, INTERVALO_ENVIO_MS);
    this.timerPing = setInterval(() => {
      this.pingEnviadoEn = Date.now();
      this.enviar({ type: 'PING' });
    }, PING_INTERVALO_MS);
    this.pingEnviadoEn = Date.now();
    this.enviar({ type: 'PING' });
  }

  private limpiarTimers() {
    if (this.timerHello) clearTimeout(this.timerHello);
    if (this.timerReintento) clearTimeout(this.timerReintento);
    if (this.timerEnvio) clearInterval(this.timerEnvio);
    if (this.timerPing) clearInterval(this.timerPing);
    this.timerHello = this.timerReintento = this.timerEnvio = this.timerPing = null;
  }
}
