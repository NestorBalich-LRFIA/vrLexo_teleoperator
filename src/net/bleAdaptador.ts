import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { BLE } from '../config';
import type { AdaptadorBle, RobotBle } from './BleSocket';

// Hermes trae btoa/atob; los paquetes son ASCII.
declare const btoa: (s: string) => string;
declare const atob: (s: string) => string;

let manager: BleManager | null = null;
function radio(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/** Pide los permisos de Bluetooth según la versión de Android. Devuelve si quedaron concedidos. */
export async function pedirPermisosBle(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const P = PermissionsAndroid.PERMISSIONS;
  const necesarios = Number(Platform.Version) >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  const r = await PermissionsAndroid.requestMultiple(necesarios);
  return necesarios.every((p) => r[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/** Espera a que el Bluetooth del celular esté prendido; llama `alCambiar(prendido)` cada vez que cambia. Devuelve cómo dejar de escuchar. */
export function vigilarBluetooth(alCambiar: (prendido: boolean) => void): () => void {
  const sub = radio().onStateChange((estado) => alCambiar(estado === State.PoweredOn), true);
  return () => sub.remove();
}

export interface ResultadoEscaneo {
  id: string;
  nombre: string;
  rssi: number | null;
}

/** Busca robots (dispositivos que anuncian el servicio BLE.servicio). Devuelve cómo parar. */
export function escanearRobots(alEncontrar: (r: ResultadoEscaneo) => void, alError: (e: unknown) => void): () => void {
  const m = radio();
  m.startDeviceScan([BLE.servicio], { allowDuplicates: false }, (error, d) => {
    if (error) return alError(error);
    if (d) alEncontrar({ id: d.id, nombre: d.localName ?? d.name ?? '', rssi: d.rssi });
  });
  return () => {
    m.stopDeviceScan().catch(() => {});
  };
}

/** Adaptador real para BleSocket: una conexión a un robot. */
export function crearAdaptadorBle(): AdaptadorBle {
  let dispositivo: Device | null = null;
  const subs: Subscription[] = [];

  const limpiar = () => {
    subs.splice(0).forEach((s) => s.remove());
  };

  return {
    async conectar(id, alRecibir, alDesconectar) {
      const m = radio();
      m.stopDeviceScan().catch(() => {});
      let d = await m.connectToDevice(id, { requestMTU: BLE.mtuPedido, timeout: BLE.conexionMs });
      d = await d.discoverAllServicesAndCharacteristics();
      dispositivo = d;
      subs.push(d.onDisconnected(() => alDesconectar()));
      subs.push(
        d.monitorCharacteristicForService(BLE.servicio, BLE.caracteristicaTx, (error, c) => {
          if (error || !c?.value) return;
          alRecibir(atob(c.value));
        }),
      );
      return { mtu: d.mtu ?? 23 };
    },
    async escribir(trozo) {
      if (!dispositivo) throw new Error('sin conexión BLE');
      await dispositivo.writeCharacteristicWithoutResponseForService(BLE.servicio, BLE.caracteristicaRx, btoa(trozo));
    },
    async desconectar() {
      limpiar();
      const d = dispositivo;
      dispositivo = null;
      if (d) await radio().cancelDeviceConnection(d.id).catch(() => {});
    },
  };
}

export type { RobotBle };
