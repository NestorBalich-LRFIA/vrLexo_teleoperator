import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { MAX_NOMBRE } from '../config';
import { t } from '../i18n';
import { colores, radio } from '../theme';

interface Props {
  nombreInicial: string;
  onConfirmar: (nombre: string) => void;
  onCancelar: () => void;
}

/** Después de leer el QR: pregunta cómo se va a llamar el robot (opcional) y conecta. */
export default function PedirNombre({ nombreInicial, onConfirmar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.titulo} accessibilityRole="header">
        {t('nombreRobot')}
      </Text>
      <Text style={styles.ayuda}>{t('nombreAyuda')}</Text>
      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
        maxLength={MAX_NOMBRE}
        placeholder={t('nombrePlaceholder')}
        placeholderTextColor={colores.textoSuave}
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => onConfirmar(nombre.trim())}
        accessibilityLabel={t('nombreRobot')}
      />
      <Pressable style={styles.principal} onPress={() => onConfirmar(nombre.trim())} accessibilityRole="button">
        <Text style={styles.principalTexto}>{t('conectar')}</Text>
      </Pressable>
      <Pressable style={styles.secundario} onPress={onCancelar} accessibilityRole="button">
        <Text style={styles.secundarioTexto}>{t('cancelar')}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, padding: 20, gap: 14, justifyContent: 'center' },
  titulo: { color: colores.texto, fontSize: 26, fontWeight: '800' },
  ayuda: { color: colores.textoSuave, fontSize: 15 },
  input: { backgroundColor: colores.superficie, color: colores.texto, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.chico, paddingHorizontal: 14, minHeight: 56, fontSize: 20 },
  principal: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  principalTexto: { color: colores.textoSobreAcento, fontSize: 20, fontWeight: '800' },
  secundario: { backgroundColor: colores.superficie, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.boton, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { color: colores.texto, fontSize: 17, fontWeight: '600' },
});
