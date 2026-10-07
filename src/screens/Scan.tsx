import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, textoErrorQr } from '../i18n';
import { parseJoinUrl } from '../qr/parseJoinUrl';
import type { Sesion } from '../storage';
import { colores, radio } from '../theme';

interface Props {
  onLeido: (s: Sesion) => void;
  onPegar: () => void;
  onVolver: () => void;
}

export default function Scan({ onLeido, onPegar, onVolver }: Props) {
  const insets = useSafeAreaInsets();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const bloqueado = useRef(false);

  function alLeer(data: string) {
    if (bloqueado.current) return;
    const r = parseJoinUrl(data);
    if (!r.ok) {
      setError(textoErrorQr(r.error));
      bloqueado.current = true;
      setTimeout(() => (bloqueado.current = false), 1500); // no repetir el mismo aviso en cada cuadro
      return;
    }
    bloqueado.current = true;
    onLeido({ url: r.url, token: r.token });
  }

  return (
    <View style={styles.pantalla}>
      {permiso?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => alLeer(data)}
        />
      ) : (
        <View style={styles.centro}>
          <Text style={styles.texto}>{t('permisoCamara')}</Text>
          <Pressable style={styles.principal} onPress={() => pedirPermiso()} accessibilityRole="button">
            <Text style={styles.principalTexto}>{t('darPermiso')}</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.arriba, { top: insets.top + 16 }]} pointerEvents="none">
        <Text style={styles.instruccion}>{t('escaneando')}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={[styles.abajo, { bottom: insets.bottom + 16 }]}>
        <Pressable style={styles.boton} onPress={onPegar} accessibilityRole="button">
          <Text style={styles.botonTexto}>{t('usarEnlace')}</Text>
        </Pressable>
        <Pressable style={styles.boton} onPress={onVolver} accessibilityRole="button">
          <Text style={styles.botonTexto}>{t('volver')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#000' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  texto: { color: colores.texto, fontSize: 18, textAlign: 'center' },
  arriba: { position: 'absolute', top: 48, left: 16, right: 16, gap: 8, alignItems: 'center' },
  instruccion: { color: colores.texto, backgroundColor: 'rgba(11,18,32,0.8)', fontSize: 18, fontWeight: '700', textAlign: 'center', padding: 10, borderRadius: radio.chico, overflow: 'hidden' },
  error: { color: colores.textoSobreAcento, backgroundColor: colores.aviso, fontSize: 16, fontWeight: '700', textAlign: 'center', padding: 10, borderRadius: radio.chico, overflow: 'hidden' },
  abajo: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 12 },
  boton: { flex: 1, minHeight: 56, borderRadius: radio.boton, backgroundColor: 'rgba(22,32,51,0.92)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colores.borde },
  botonTexto: { color: colores.texto, fontSize: 16, fontWeight: '700' },
  principal: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 56, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  principalTexto: { color: colores.textoSobreAcento, fontSize: 18, fontWeight: '800' },
});
