import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import type { Actualizacion } from '../update/actualizacion';
import { colores, radio } from '../theme';

interface Props {
  actualizacion: Actualizacion;
  versionActual: string;
  onActualizar: () => void;
  onContinuar: () => void;
}

/** Aviso de versión nueva, al escanear el QR. Se puede seguir sin actualizar. */
export default function AvisoActualizacion({ actualizacion, versionActual, onActualizar, onContinuar }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onContinuar} statusBarTranslucent>
      <View style={styles.velo}>
        <View style={styles.tarjeta} accessibilityViewIsModal>
          <Text style={styles.titulo} accessibilityRole="header">
            {t('actualizacionTitulo')}
          </Text>
          <Text style={styles.texto}>{t('actualizacionTexto', { v: actualizacion.versionName, actual: versionActual })}</Text>
          <Pressable style={styles.principal} onPress={onActualizar} accessibilityRole="button">
            <Text style={styles.principalTexto}>{t('actualizar')}</Text>
          </Pressable>
          <Pressable style={styles.secundario} onPress={onContinuar} accessibilityRole="button">
            <Text style={styles.secundarioTexto}>{t('continuarIgual')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  velo: { flex: 1, backgroundColor: 'rgba(11,18,32,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: radio.tarjeta, padding: 22, width: '100%', maxWidth: 440, gap: 14 },
  titulo: { color: colores.texto, fontSize: 22, fontWeight: '800' },
  texto: { color: colores.texto, fontSize: 16, lineHeight: 22 },
  principal: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  principalTexto: { color: colores.textoSobreAcento, fontSize: 18, fontWeight: '800' },
  secundario: { backgroundColor: colores.superficieAlta, borderRadius: radio.boton, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { color: colores.texto, fontSize: 16, fontWeight: '700' },
});
