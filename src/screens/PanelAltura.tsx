import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colores } from '../theme';

const ICONO = 22;
export const ANCHO_PANEL_ALTURA = 64;

interface Props {
  /** Altura 0..1. */
  altura: Animated.Value;
  color: string;
  x: number;
  y: number;
  alto: number;
}

/** Barra vertical que sube según la altura (simulada) del robot, con un helicóptero en la punta. */
export default function PanelAltura({ altura, color, x, y, alto }: Props) {
  const pista = Math.max(20, alto - 30); // alto de la barra (queda lugar para el rótulo)
  return (
    <View
      pointerEvents="none"
      style={[styles.panel, { left: x, top: y, width: ANCHO_PANEL_ALTURA, height: alto }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={styles.rotulo} numberOfLines={1}>
        {t('altura')}
      </Text>
      <View style={[styles.pista, { height: pista }]}>
        {[0.25, 0.5, 0.75].map((m) => (
          <View key={m} style={[styles.marca, { bottom: m * pista }]} />
        ))}
        <Animated.View
          style={[styles.relleno, { backgroundColor: color, height: altura.interpolate({ inputRange: [0, 1], outputRange: [0, pista] }) }]}
        />
        <Animated.Text
          style={[styles.heli, { bottom: altura.interpolate({ inputRange: [0, 1], outputRange: [0, pista - ICONO] }) }]}
        >
          🚁
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 3, borderColor: colores.borde, alignItems: 'center', paddingTop: 3, overflow: 'hidden' },
  rotulo: { color: '#6b7a99', fontSize: 9, fontWeight: '800', height: 14 },
  pista: { width: 28, backgroundColor: '#e6ebf5', borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  relleno: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  marca: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#aab4c8' },
  heli: { position: 'absolute', alignSelf: 'center', fontSize: 16, lineHeight: ICONO },
});
