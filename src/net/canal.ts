import type { Sesion } from '../storage';
import type { RobotBle } from './BleSocket';

/** Por dónde está conectado el control: servidor del simulador (QR) o robot físico (Bluetooth). */
export type Canal = { tipo: 'qr'; sesion: Sesion } | { tipo: 'ble'; robot: RobotBle };
