import { BLE } from '../config';
import type { WebSocketLike } from './ExtClient';

/**
 * Lo que BleSocket necesita de la radio Bluetooth. La implementación real (react-native-ble-plx) está en
 * bleAdaptador.ts; los tests usan una falsa.
 */
export interface AdaptadorBle {
  /**
   * Conecta al dispositivo, negocia el MTU y se suscribe a las notificaciones del robot.
   * `alRecibir` recibe texto crudo (puede venir partido); `alDesconectar` se llama si el enlace se corta.
   * Devuelve el MTU negociado (23 si no se pudo subir). Rechaza si no se pudo conectar.
   */
  conectar(id: string, alRecibir: (texto: string) => void, alDesconectar: () => void): Promise<{ mtu: number }>;
  /** Escribe un trozo (≤ mtu−3 bytes) en la característica RX, sin respuesta. */
  escribir(trozo: string): Promise<void>;
  desconectar(): Promise<void>;
}

export interface RobotBle {
  id: string;
  nombre: string;
}

/**
 * Hace pasar un robot BLE por un WebSocket: ExtClient habla con él igual que con el servidor y los paquetes son los mismos.
 *
 * - Cada paquete viaja como una línea JSON terminada en "\n", troceada según el MTU (el firmware junta hasta el "\n").
 * - El robot no entiende el handshake del servidor, así que lo resuelve la app: EXT_HELLO se contesta con un EXT_READY
 *   local, PING con un PONG local y EXT_LEAVE no se envía. Todo lo demás (ROBOT_COMMAND, ROBOT_SET) va tal cual.
 * - Los paquetes se escriben de a uno; si la cola se atrasa, un ROBOT_COMMAND nuevo reemplaza al pendiente
 *   (al robot le importa la orden más reciente, no las viejas).
 * - Solo ASCII: los paquetes de la app no llevan otros caracteres (id, tipos y números).
 */
export class BleSocket implements WebSocketLike {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;

  private mtu = 23;
  private abierto = false;
  private cerrado = false;
  private entrada = '';
  private cola: string[] = [];
  private escribiendo: Promise<void> | null = null;

  constructor(
    private readonly radio: AdaptadorBle,
    private readonly robot: RobotBle,
  ) {
    void this.iniciar();
  }

  private async iniciar() {
    try {
      const { mtu } = await this.radio.conectar(
        this.robot.id,
        (texto) => this.alRecibir(texto),
        () => this.alCortarse(),
      );
      if (this.cerrado) {
        void this.radio.desconectar().catch(() => {});
        return;
      }
      this.mtu = Math.max(23, mtu);
      this.abierto = true;
      this.onopen?.();
    } catch (e) {
      if (this.cerrado) return;
      this.onerror?.(e);
      this.alCortarse();
    }
  }

  send(data: string): void {
    if (this.cerrado || !this.abierto) return;
    let tipo = '';
    try {
      tipo = JSON.parse(data)?.type ?? '';
    } catch {
      return;
    }
    switch (tipo) {
      case 'EXT_HELLO':
        // El robot no tiene token ni aula: el "robot" de la app es el dispositivo al que nos conectamos.
        return this.entregar({
          type: 'EXT_READY',
          spawned: { id: this.robot.id, name: this.robot.nombre, color: '#1c7ed6', slot: 0, adopted: true, nameRejected: false },
        });
      case 'PING':
        return this.entregar({ type: 'PONG' });
      case 'EXT_LEAVE':
        return;
      default:
        this.encolar(data, tipo);
    }
  }

  close(): void {
    if (this.cerrado) return;
    this.cerrado = true;
    // Se vacía la cola (por ejemplo el cero de "soltar todo") antes de cortar el enlace.
    const fin = () => void this.radio.desconectar().catch(() => {});
    if (this.escribiendo || this.cola.length) void this.vaciar().then(fin, fin);
    else fin();
  }

  // ---- hacia el robot ----

  private encolar(data: string, tipo: string) {
    if (tipo === 'ROBOT_COMMAND') {
      // Una orden nueva reemplaza a la anterior que todavía no salió; si la cola se atrasa, se descartan las viejas.
      const i = this.cola.findIndex((l) => l.includes('"type":"ROBOT_COMMAND"'));
      if (i >= 0) this.cola.splice(i, 1);
      while (this.cola.length >= BLE.colaMax) this.cola.shift();
    }
    this.cola.push(data + '\n');
    void this.vaciar();
  }

  private vaciar(): Promise<void> {
    if (!this.escribiendo) {
      this.escribiendo = this.bombear().finally(() => {
        this.escribiendo = null;
      });
    }
    return this.escribiendo;
  }

  private async bombear() {
    const tam = this.mtu - 3;
    while (this.cola.length) {
      const linea = this.cola.shift()!;
      try {
        for (let i = 0; i < linea.length; i += tam) await this.radio.escribir(linea.slice(i, i + tam));
      } catch (e) {
        this.cola.length = 0;
        if (!this.cerrado) {
          this.onerror?.(e);
          this.alCortarse();
        }
        return;
      }
    }
  }

  // ---- desde el robot ----

  private alRecibir(texto: string) {
    this.entrada += texto;
    let i: number;
    while ((i = this.entrada.indexOf('\n')) >= 0) {
      const linea = this.entrada.slice(0, i).trim();
      this.entrada = this.entrada.slice(i + 1);
      if (linea && !this.cerrado) this.onmessage?.({ data: linea });
    }
    if (this.entrada.length > 4096) this.entrada = ''; // basura sin "\n": no crecer sin límite
  }

  private alCortarse() {
    if (this.cerrado) return;
    this.cerrado = true;
    this.abierto = false;
    this.cola.length = 0;
    void this.radio.desconectar().catch(() => {});
    this.onclose?.();
  }

  private entregar(obj: object) {
    // Asíncrono, como un socket real: ExtClient todavía está terminando de enviar el HELLO.
    setTimeout(() => {
      if (!this.cerrado) this.onmessage?.({ data: JSON.stringify({ protocol: 'R26', version: 1, ...obj }) });
    }, 0);
  }
}
