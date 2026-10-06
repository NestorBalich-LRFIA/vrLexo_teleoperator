import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MAX_NOMBRE } from '../config';
import { t, textoErrorQr } from '../i18n';
import { parseJoinUrl } from '../qr/parseJoinUrl';
import type { Sesion } from '../storage';
import { colores, radio } from '../theme';

interface Props {
  nombre: string;
  onNombre: (n: string) => void;
  volarSaltando: boolean;
  onVolarSaltando: (v: boolean) => void;
  inclinacion: boolean;
  onInclinacion: (v: boolean) => void;
  sesionGuardada: Sesion | null;
  mensaje: string | null;
  version: string;
  onEscanear: () => void;
  onConectar: (s: Sesion) => void;
  onAyuda: () => void;
}

export default function Home(p: Props) {
  const [pegando, setPegando] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string | null>(null);

  function conectarConEnlace() {
    const r = parseJoinUrl(enlace);
    if (!r.ok) return setError(textoErrorQr(r.error));
    setError(null);
    p.onConectar({ url: r.url, token: r.token });
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo} accessibilityRole="header">
          {t('appNombre')}
        </Text>

        {p.mensaje && (
          <View style={styles.mensaje} accessibilityLiveRegion="polite">
            <Text style={styles.mensajeTexto}>{p.mensaje}</Text>
          </View>
        )}

        <Text style={styles.etiqueta}>{t('nombreRobot')}</Text>
        <TextInput
          style={styles.input}
          value={p.nombre}
          onChangeText={p.onNombre}
          maxLength={MAX_NOMBRE}
          placeholder={t('nombrePlaceholder')}
          placeholderTextColor={colores.textoSuave}
          autoCorrect={false}
          accessibilityLabel={t('nombreRobot')}
        />

        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.etiqueta}>{t('volarSaltando')}</Text>
            <Text style={styles.ayuda}>{t('volarSaltandoAyuda')}</Text>
          </View>
          <Switch
            value={p.volarSaltando}
            onValueChange={p.onVolarSaltando}
            trackColor={{ false: colores.borde, true: colores.acento }}
            thumbColor={colores.texto}
            accessibilityLabel={t('volarSaltando')}
          />
        </View>

        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.etiqueta}>{t('manejarInclinando')}</Text>
            <Text style={styles.ayuda}>{t('manejarInclinandoAyuda')}</Text>
          </View>
          <Switch
            value={p.inclinacion}
            onValueChange={p.onInclinacion}
            trackColor={{ false: colores.borde, true: colores.acento }}
            thumbColor={colores.texto}
            accessibilityLabel={t('manejarInclinando')}
          />
        </View>

        <Pressable style={styles.principal} onPress={p.onEscanear} accessibilityRole="button" accessibilityLabel={t('escanear')}>
          <Text style={styles.principalTexto}>📷 {t('escanear')}</Text>
        </Pressable>

        {p.sesionGuardada && (
          <Pressable style={styles.secundario} onPress={() => p.onConectar(p.sesionGuardada!)} accessibilityRole="button">
            <Text style={styles.secundarioTexto}>↻ {t('volverAEntrar')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.secundario} onPress={() => setPegando((v) => !v)} accessibilityRole="button">
          <Text style={styles.secundarioTexto}>🔗 {t('pegarEnlace')}</Text>
        </Pressable>
        {pegando && (
          <View style={styles.pegar}>
            <Text style={styles.ayuda}>{t('pegarEnlaceAyuda')}</Text>
            <TextInput
              style={styles.input}
              value={enlace}
              onChangeText={(v) => {
                setEnlace(v);
                setError(null);
              }}
              placeholder={t('enlacePlaceholder')}
              placeholderTextColor={colores.textoSuave}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('pegarEnlace')}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.principal} onPress={conectarConEnlace} accessibilityRole="button">
              <Text style={styles.principalTexto}>{t('conectar')}</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.secundario} onPress={p.onAyuda} accessibilityRole="button">
          <Text style={styles.secundarioTexto}>❓ {t('comoSeUsa')}</Text>
        </Pressable>

        <Text style={styles.version}>{t('version', { v: p.version })}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 20, gap: 14 },
  titulo: { color: colores.texto, fontSize: 30, fontWeight: '800', marginTop: 24 },
  mensaje: { backgroundColor: colores.superficieAlta, borderLeftWidth: 6, borderLeftColor: colores.aviso, borderRadius: radio.chico, padding: 14 },
  mensajeTexto: { color: colores.texto, fontSize: 16 },
  etiqueta: { color: colores.texto, fontSize: 16, fontWeight: '700' },
  ayuda: { color: colores.textoSuave, fontSize: 14 },
  input: { backgroundColor: colores.superficie, color: colores.texto, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.chico, paddingHorizontal: 14, minHeight: 52, fontSize: 18 },
  principal: { backgroundColor: colores.acento, borderRadius: radio.boton, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  principalTexto: { color: colores.textoSobreAcento, fontSize: 20, fontWeight: '800' },
  secundario: { backgroundColor: colores.superficie, borderColor: colores.borde, borderWidth: 2, borderRadius: radio.boton, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { color: colores.texto, fontSize: 17, fontWeight: '600' },
  pegar: { gap: 10 },
  error: { color: colores.peligro, fontSize: 15, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colores.superficie, borderRadius: radio.tarjeta, padding: 14 },
  version: { color: colores.textoSuave, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
