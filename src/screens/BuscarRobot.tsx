import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BLE } from '../config';
import { t } from '../i18n';
import { escanearRobots, pedirPermisosBle, ResultadoEscaneo, vigilarBluetooth } from '../net/bleAdaptador';
import type { RobotBle } from '../net/BleSocket';
import { colores, radio } from '../theme';

interface Props {
  onElegido: (r: RobotBle) => void;
  onVolver: () => void;
  onAyuda: () => void;
}

type Estado = 'permiso' | 'apagado' | 'buscando' | 'listo';

/** Busca robots por Bluetooth (los que anuncian el servicio de la app) y deja elegir uno. */
export default function BuscarRobot({ onElegido, onVolver, onAyuda }: Props) {
  const [estado, setEstado] = useState<Estado>('buscando');
  const [robots, setRobots] = useState<ResultadoEscaneo[]>([]);
  const prendido = useRef<boolean | null>(null);
  const parar = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detener = useCallback(() => {
    parar.current?.();
    parar.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const buscar = useCallback(async () => {
    detener();
    if (!(await pedirPermisosBle())) return setEstado('permiso');
    if (prendido.current === false) return setEstado('apagado');
    setRobots([]);
    setEstado('buscando');
    parar.current = escanearRobots(
      (r) => setRobots((prev) => (prev.some((p) => p.id === r.id) ? prev.map((p) => (p.id === r.id ? r : p)) : [...prev, r])),
      () => setEstado('apagado'),
    );
    timer.current = setTimeout(() => {
      detener();
      setEstado('listo');
    }, BLE.escaneoMs);
  }, [detener]);

  useEffect(() => {
    const dejar = vigilarBluetooth((on) => {
      const antes = prendido.current;
      prendido.current = on;
      if (antes !== on) void buscar();
    });
    return () => {
      dejar();
      detener();
    };
  }, [buscar, detener]);

  const ordenados = [...robots].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  return (
    <View style={styles.pantalla}>
      <Text style={styles.titulo} accessibilityRole="header">
        {t('bleTitulo')}
      </Text>

      {estado === 'permiso' && (
        <View style={styles.centro}>
          <Text style={styles.texto}>{t('blePermiso')}</Text>
          <Pressable style={styles.principal} onPress={() => void buscar()} accessibilityRole="button">
            <Text style={styles.principalTexto}>{t('bleDarPermiso')}</Text>
          </Pressable>
        </View>
      )}

      {estado === 'apagado' && (
        <View style={styles.centro}>
          <Text style={styles.texto}>{t('bleApagado')}</Text>
        </View>
      )}

      {(estado === 'buscando' || estado === 'listo') && (
        <>
          <View style={styles.estado} accessibilityLiveRegion="polite">
            {estado === 'buscando' && <ActivityIndicator color={colores.acento} />}
            <Text style={styles.textoSuave}>{estado === 'buscando' ? t('bleBuscando') : ordenados.length ? '' : t('bleSinResultados')}</Text>
          </View>
          <FlatList
            data={ordenados}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.fila}
                onPress={() => {
                  detener();
                  onElegido({ id: item.id, nombre: item.nombre || t('bleSinNombre') });
                }}
                accessibilityRole="button"
              >
                <Text style={styles.filaNombre} numberOfLines={1}>
                  🤖 {item.nombre || t('bleSinNombre')}
                </Text>
                {item.rssi != null && <Text style={styles.textoSuave}>{t('bleSenal', { dbm: item.rssi })}</Text>}
              </Pressable>
            )}
          />
          {estado === 'listo' && (
            <Pressable style={styles.secundario} onPress={() => void buscar()} accessibilityRole="button">
              <Text style={styles.secundarioTexto}>↻ {t('bleBuscarDeNuevo')}</Text>
            </Pressable>
          )}
        </>
      )}

      <Pressable style={styles.secundario} onPress={onAyuda} accessibilityRole="button">
        <Text style={styles.secundarioTexto}>❓ {t('comoSeUsa')}</Text>
      </Pressable>
      <Pressable style={styles.secundario} onPress={onVolver} accessibilityRole="button">
        <Text style={styles.secundarioTexto}>← {t('volver')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, padding: 20, gap: 14 },
  titulo: { color: colores.texto, fontSize: 26, fontWeight: '800', marginTop: 12 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  texto: { color: colores.texto, fontSize: 17, textAlign: 'center' },
  textoSuave: { color: colores.textoSuave, fontSize: 14 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  fila: { backgroundColor: colores.superficie, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.boton, padding: 16, gap: 4, minHeight: 64, justifyContent: 'center' },
  filaNombre: { color: colores.texto, fontSize: 18, fontWeight: '700' },
  principal: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 56, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  principalTexto: { color: colores.textoSobreAcento, fontSize: 18, fontWeight: '800' },
  secundario: { backgroundColor: colores.superficie, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.boton, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { color: colores.texto, fontSize: 17, fontWeight: '600' },
});
