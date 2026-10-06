import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { MAX_NOMBRE } from './config';

const K = {
  deviceId: 'vrlexo.deviceId',
  nombre: 'vrlexo.ultimoNombre',
  sesion: 'vrlexo.sesion',
  volarSaltando: 'vrlexo.volarSaltando',
  inclinacion: 'vrlexo.inclinacion',
};

export interface Sesion {
  url: string;
  token: string;
}

/** UUID generado una sola vez y guardado en el celular: permite recuperar el mismo robot tras un corte. */
export async function obtenerDeviceId(): Promise<string> {
  try {
    const guardado = await AsyncStorage.getItem(K.deviceId);
    if (guardado) return guardado;
  } catch {}
  const nuevo = Crypto.randomUUID();
  try {
    await AsyncStorage.setItem(K.deviceId, nuevo);
  } catch {}
  return nuevo;
}

export async function leerNombre(): Promise<string> {
  try {
    return ((await AsyncStorage.getItem(K.nombre)) ?? '').slice(0, MAX_NOMBRE);
  } catch {
    return '';
  }
}

export async function guardarNombre(nombre: string): Promise<void> {
  try {
    await AsyncStorage.setItem(K.nombre, nombre.trim().slice(0, MAX_NOMBRE));
  } catch {}
}

export async function leerSesion(): Promise<Sesion | null> {
  try {
    const raw = await AsyncStorage.getItem(K.sesion);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.url === 'string' && typeof s?.token === 'string' ? s : null;
  } catch {
    return null;
  }
}

export async function guardarSesion(s: Sesion): Promise<void> {
  try {
    await AsyncStorage.setItem(K.sesion, JSON.stringify(s));
  } catch {}
}

/** Borra el token guardado (QR vencido, regenerado, EXT_CLOSED…). */
export async function borrarSesion(): Promise<void> {
  try {
    await AsyncStorage.removeItem(K.sesion);
  } catch {}
}

export async function leerVolarSaltando(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(K.volarSaltando)) !== '0'; // activado por defecto
  } catch {
    return true;
  }
}

export async function guardarVolarSaltando(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(K.volarSaltando, v ? '1' : '0');
  } catch {}
}

/** Manejar inclinando el celular: apagado por defecto. */
export async function leerInclinacion(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(K.inclinacion)) === '1';
  } catch {
    return false;
  }
}

export async function guardarInclinacion(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(K.inclinacion, v ? '1' : '0');
  } catch {}
}
