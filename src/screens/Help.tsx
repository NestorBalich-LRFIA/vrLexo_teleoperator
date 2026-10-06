import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colores, radio } from '../theme';

export default function Help({ onVolver, version }: { onVolver: () => void; version: string }) {
  const pasos = [
    ['ayudaPaso1Titulo', 'ayudaPaso1'],
    ['ayudaPaso2Titulo', 'ayudaPaso2'],
    ['ayudaPaso3Titulo', 'ayudaPaso3'],
  ] as const;
  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo} accessibilityRole="header">
        {t('comoSeUsa')}
      </Text>
      {pasos.map(([titulo, texto]) => (
        <View key={titulo} style={styles.paso}>
          <Text style={styles.pasoTitulo}>{t(titulo)}</Text>
          <Text style={styles.pasoTexto}>{t(texto)}</Text>
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
  pasoTexto: { color: colores.texto, fontSize: 17, lineHeight: 24 },
  boton: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 60, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  botonTexto: { color: colores.textoSobreAcento, fontSize: 18, fontWeight: '800' },
  version: { color: colores.textoSuave, fontSize: 13, textAlign: 'center' },
});
