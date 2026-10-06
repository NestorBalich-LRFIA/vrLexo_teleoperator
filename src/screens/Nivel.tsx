import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { INCLINACION } from '../config';
import { t } from '../i18n';
import { colores } from '../theme';

const BOLITA = 28;

/** Una celda de la grilla 3x3: fila 0 = arriba (adelante), columna 0 = izquierda. */
const CELDAS: { icono: string | null }[] = [
  { icono: null }, { icono: '▲' }, { icono: null },
  { icono: '◀' }, { icono: 'STOP' }, { icono: '▶' },
  { icono: null }, { icono: '▼' }, { icono: null },
];

interface Props {
  /** Posición de la bolita: x −1..1 (derecha +), y −1..1 (abajo +). */
  pos: Animated.ValueXY;
  /** Celda activa 0..8 (4 = centro/stop). */
  celda: number;
  color: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Cuadro blanco dividido en 9 celdas con una bolita que sigue la inclinación del celular.
 * Los bordes entre celdas están en ±1/3 de la inclinación máxima = fin de la zona muerta, así que
 * la celda iluminada es la orden que realmente recibe el robot (centro = parado).
 */
export default function Nivel({ pos, celda, color, x, y, ancho, alto }: Props) {
  const tercioX = ancho / 3;
  const tercioY = alto / 3;
  // recorrido máximo del centro de la bolita en cada eje
  const rX = ancho / 2 - BOLITA / 2 - 3;
  const rY = alto / 2 - BOLITA / 2 - 3;
  // v = ±1/3 cae justo en el borde de la celda central; v = ±1 llega al tope. Tramos lineales.
  const rango = [-1, -1 / 3, 1 / 3, 1];
  const salidaX = [-rX, -tercioX / 2, tercioX / 2, rX];
  const salidaY = [-rY, -tercioY / 2, tercioY / 2, rY];
  return (
    <View
      pointerEvents="none"
      style={[styles.cuadro, { left: x, top: y, width: ancho, height: alto }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {CELDAS.map((c, i) => {
        const activa = i === celda;
        return (
          <View
            key={i}
            style={[
              styles.celda,
              {
                left: (i % 3) * tercioX,
                top: Math.floor(i / 3) * tercioY,
                width: tercioX,
                height: tercioY,
              },
              activa && { backgroundColor: color },
            ]}
          >
            {c.icono && (
              <Text style={[c.icono === 'STOP' ? styles.stop : styles.icono, activa && styles.activo]} numberOfLines={1}>
                {c.icono === 'STOP' ? t('parar') : c.icono}
              </Text>
            )}
          </View>
        );
      })}
      <Animated.View
        style={[
          styles.bolita,
          {
            backgroundColor: color,
            left: (ancho - BOLITA) / 2 - 3,
            top: (alto - BOLITA) / 2 - 3,
            transform: [
              { translateX: pos.x.interpolate({ inputRange: rango, outputRange: salidaX }) },
              { translateY: pos.y.interpolate({ inputRange: rango, outputRange: salidaY }) },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cuadro: { position: 'absolute', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 3, borderColor: colores.borde, overflow: 'hidden' },
  celda: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: '#aab4c8', alignItems: 'center', justifyContent: 'center' },
  icono: { color: '#6b7a99', fontSize: 22, fontWeight: '700' },
  stop: { color: '#6b7a99', fontSize: 13, fontWeight: '800' },
  activo: { color: '#06101f' },
  bolita: { position: 'absolute', width: BOLITA, height: BOLITA, borderRadius: BOLITA / 2, borderWidth: 3, borderColor: '#06101f' },
});
