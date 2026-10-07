import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { URL_SITIO } from '../config';
import { t } from '../i18n';
import { colores, radio } from '../theme';

/** Dónde aparece este texto en un paso, se muestra como enlace al sitio. */
const HOST_SITIO = 'vr.lexodive.com';

const PASOS_QR = [
  ['ayudaPaso1Titulo', 'ayudaPaso1'],
  ['ayudaPaso2Titulo', 'ayudaPaso2'],
  ['ayudaPaso3Titulo', 'ayudaPaso3'],
] as const;
const PASOS_BLE = [
  ['ayudaBle1Titulo', 'ayudaBle1'],
  ['ayudaBle2Titulo', 'ayudaBle2'],
  ['ayudaBle3Titulo', 'ayudaBle3'],
] as const;

export default function Help({ onVolver, version, tema = 'qr' }: { onVolver: () => void; version: string; tema?: 'qr' | 'ble' }) {
  const pasos = tema === 'ble' ? PASOS_BLE : PASOS_QR;
  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo} accessibilityRole="header">
        {t('comoSeUsa')}
      </Text>
      {pasos.map(([titulo, texto]) => (
        <View key={titulo} style={styles.paso}>
          <Text style={styles.pasoTitulo}>{t(titulo)}</Text>
          <Text style={styles.pasoTexto}>
            {t(texto)
              .split(HOST_SITIO)
              .flatMap((trozo, i) => [
                i > 0 && (
                  <Text key={`l${i}`} style={styles.enlace} onPress={() => Linking.openURL(URL_SITIO).catch(() => {})} accessibilityRole="link">
                    {HOST_SITIO}
                  </Text>
                ),
                trozo,
              ])}
          </Text>
        </View>
      ))}
      <Pressable style={styles.boton} onPress={onVolver} accessibilityRole="button">
        <Text style={styles.botonTexto}>{t('volver')}</Text>
      </Pressable>
      <Text style={styles.version}>{t('version', { v: version })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 20, gap: 14 },
  titulo: { color: colores.texto, fontSize: 28, fontWeight: '800', marginTop: 24 },
  paso: { backgroundColor: colores.superficie, borderRadius: radio.tarjeta, padding: 16, gap: 6 },
  pasoTitulo: { color: colores.acento, fontSize: 20, fontWeight: '800' },
  enlace: { color: colores.acento, fontWeight: '800', textDecorationLine: 'underline' },
  pasoTexto: { color: colores.texto, fontSize: 17, lineHeight: 24 },
  boton: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 60, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  botonTexto: { color: colores.textoSobreAcento, fontSize: 18, fontWeight: '800' },
  version: { color: colores.textoSuave, fontSize: 13, textAlign: 'center' },
});
