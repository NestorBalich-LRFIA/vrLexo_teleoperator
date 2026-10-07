import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, AppState, GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SACUDIDA } from '../config';
import { t, textoFin } from '../i18n';
import { crearAdaptadorBle } from '../net/bleAdaptador';
import { BleSocket, RobotBle } from '../net/BleSocket';
import type { Canal } from '../net/canal';
import { Boton, ExtClient } from '../net/ExtClient';
import { FlightController } from '../sensors/FlightController';
import { TiltController, celdaDe } from '../sensors/TiltController';
import { AlturaSimulada } from '../sensors/AlturaSimulada';
import Nivel from './Nivel';
import PanelAltura, { ANCHO_PANEL_ALTURA } from './PanelAltura';
import { borrarSesion, guardarInclinacion, guardarNombre, guardarRobotBle } from '../storage';
import { BOTON_MIN, colores, radio, textoSobre } from '../theme';

export type DestinoSalida = 'inicio' | 'escanear' | 'reintentar';

interface Props {
  /** null = todavía no se eligió cómo conectar: se muestra el panel con QR / Bluetooth. */
  canal: Canal | null;
  /** Último robot Bluetooth usado (para reconectar con un toque). */
  robotBleGuardado: RobotBle | null;
  onEscanear: () => void;
  onBluetooth: () => void;
  onReconectarBle: (r: RobotBle) => void;
  nombre: string;
  deviceId: string;
  volarSaltando: boolean;
  inclinacion: boolean;
  onSalir: (destino: DestinoSalida) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Accesorios del robot (ROBOT_SET led / sword / buzzer): van en las celdas libres de la cruz.
type Accion = 'led' | 'espada' | 'buzzer';
type Tecla = Boton | Accion;
const ACCIONES: Accion[] = ['led', 'espada', 'buzzer'];
const BOTONES: Tecla[] = ['adelante', 'atras', 'izquierda', 'derecha', 'volar', 'stop', 'led', 'espada', 'buzzer'];
const NINGUNO: Record<Tecla, boolean> = {
  adelante: false,
  atras: false,
  izquierda: false,
  derecha: false,
  volar: false,
  stop: false,
  led: false,
  espada: false,
  buzzer: false,
};
const BARRA = 64;
const MARGEN = 16;
const HUECO = 12;
const ALTO_INCLINAR = 48;

/**
 * Posiciones de los botones dentro del área de toque, en vertical (todo en dp, sin depender de re-renders).
 * De abajo hacia arriba: la cruz (adelante arriba, atrás abajo, girar a los lados, STOP en el centro y Volar en la
 * esquina de arriba a la derecha, junto a adelante), el botón Manejar inclinando y, arriba de todo, los instrumentos.
 */
function calcularRects(w: number, h: number): Record<Tecla, Rect> {
  // Con los instrumentos arriba (mínimo 64), achicar los botones sin bajar de BOTON_MIN.
  const lado = Math.max(BOTON_MIN, Math.min(150, (w - 2 * MARGEN - 2 * HUECO) / 3, (h - 184) / 3));
  const cruz = 3 * lado + 2 * HUECO;
  const x0 = (w - cruz) / 2;
  const paso = lado + HUECO;
  const y0 = h - MARGEN - cruz;
  return {
    adelante: { x: x0 + paso, y: y0, w: lado, h: lado },
    izquierda: { x: x0, y: y0 + paso, w: lado, h: lado },
    derecha: { x: x0 + 2 * paso, y: y0 + paso, w: lado, h: lado },
    atras: { x: x0 + paso, y: y0 + 2 * paso, w: lado, h: lado },
    stop: { x: x0 + paso, y: y0 + paso, w: lado, h: lado },
    volar: { x: x0 + 2 * paso, y: y0, w: lado, h: lado },
    led: { x: x0, y: y0, w: lado, h: lado },
    espada: { x: x0, y: y0 + 2 * paso, w: lado, h: lado },
    buzzer: { x: x0 + 2 * paso, y: y0 + 2 * paso, w: lado, h: lado },
  };
}

interface Instrumentos {
  /** Botón "Manejar inclinando", justo arriba de la cruz (de Volar y adelante). */
  inclinar: Rect;
  /** null si no hay lugar arriba (pantalla baja). */
  nivel: Rect | null;
  panelAltura: Rect;
}

/**
 * Justo arriba de la cruz, el botón "Manejar inclinando". Más arriba, ocupando todo el lugar libre: el cuadro de la bolita
 * (rectángulo, tan ancho y alto como entre) y la barra de altura a su derecha. Si no hay lugar, se oculta el cuadro y
 * la barra queda arriba a la derecha.
 */
function calcularInstrumentos(w: number, rects: Record<Tecla, Rect>): Instrumentos {
  const ancho = ANCHO_PANEL_ALTURA;
  const inclinar: Rect = { x: MARGEN, y: rects.adelante.y - HUECO - ALTO_INCLINAR, w: w - 2 * MARGEN, h: ALTO_INCLINAR };
  const tope = 8;
  const fondo = inclinar.y - HUECO; // los instrumentos van entre tope y fondo
  const alto = Math.min(300, fondo - tope);
  const anchoNivel = Math.min(420, w - 2 * MARGEN - HUECO - ancho);
  if (alto >= 64 && anchoNivel >= 64) {
    const x = (w - (anchoNivel + HUECO + ancho)) / 2;
    const y = tope + (fondo - tope - alto) / 2;
    return {
      inclinar,
      nivel: { x, y, w: anchoNivel, h: alto },
      panelAltura: { x: x + anchoNivel + HUECO, y, w: ancho, h: alto },
    };
  }
  return {
    inclinar,
    nivel: null,
    panelAltura: { x: w - MARGEN - ancho, y: tope, w: ancho, h: Math.max(48, fondo - tope) },
  };
}

const ETIQUETAS: Record<Tecla, { icono: string; clave: 'adelante' | 'atras' | 'girarIzquierda' | 'girarDerecha' | 'volar' | 'parar' | 'led' | 'espada' | 'buzzer' }> = {
  adelante: { icono: '▲', clave: 'adelante' },
  atras: { icono: '▼', clave: 'atras' },
  izquierda: { icono: '◀', clave: 'girarIzquierda' },
  derecha: { icono: '▶', clave: 'girarDerecha' },
  volar: { icono: '🚁', clave: 'volar' },
  stop: { icono: '■', clave: 'parar' },
  led: { icono: '💡', clave: 'led' },
  espada: { icono: '⚔️', clave: 'espada' },
  buzzer: { icono: '🔔', clave: 'buzzer' },
};

export default function Control({ canal, robotBleGuardado, onEscanear, onBluetooth, onReconectarBle, nombre, deviceId, volarSaltando, inclinacion: inclinacionInicial, onSalir }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  // Manejar inclinando: arranca como en Inicio y se puede cambiar acá mismo.
  const [inclinacion, setInclinacion] = useState(inclinacionInicial);
  function alternarInclinacion() {
    const nuevo = !inclinacion;
    setInclinacion(nuevo);
    guardarInclinacion(nuevo);
    Haptics.selectionAsync().catch(() => {});
  }
  const client = useMemo(() => {
    if (canal?.tipo === 'ble') {
      const robot = canal.robot;
      return new ExtClient({
        url: `ble://${robot.id}`,
        token: '',
        deviceId,
        canal: 'ble',
        crearWebSocket: () => new BleSocket(crearAdaptadorBle(), robot),
      });
    }
    return new ExtClient({ url: canal?.sesion.url ?? '', token: canal?.sesion.token ?? '', deviceId, name: nombre });
  }, [canal, deviceId, nombre]);
  const porBle = canal?.tipo === 'ble';
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [apretados, setApretados] = useState<Record<Tecla, boolean>>({ ...NINGUNO });
  const previo = useRef<Record<Tecla, boolean>>({ ...apretados });
  const [toast, setToast] = useState<string | null>(null);
  const rects = useMemo(() => calcularRects(tam.w, tam.h), [tam]);
  const instr = useMemo(() => calcularInstrumentos(tam.w, rects), [tam.w, rects]);

  // Vertical y bloqueada mientras dure la pantalla.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  // Conexión: se abre al montar y se cierra al desmontar.
  useEffect(() => {
    if (canal) {
      guardarNombre(nombre);
      client.conectar();
    }
    return () => client.destruir();
  }, [client, canal, nombre]);

  // Segundo plano: soltar todo, cero y cerrar; al volver, reconectar con el mismo deviceId.
  useEffect(() => {
    if (!canal) return; // sin canal elegido no hay nada que pausar ni reanudar (reanudar abriría un socket sin URL)
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') client.reanudar();
      else client.pausar();
    });
    return () => sub.remove();
  }, [client, canal]);

  // Un solo acelerómetro (~50 Hz): hélice por sacudida, burbuja (siempre visible) y manejo por inclinación (solo si está activado).
  const inclinador = useRef(new TiltController());
  // Barra de altura (simulada): se actualiza sin re-renderizar, con la hélice que se está mandando.
  const alturaAnim = useRef(new Animated.Value(0)).current;
  const heliceRef = useRef(0);
  const [celda, setCelda] = useState(4);
  const incPrevio = useRef(false);
  const burbuja = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  useEffect(() => {
    const vuelo = new FlightController();
    let ultimoEnvio = 0;
    let ultimoNivel = 0;
    let ultimaInc: { traction: number; steering: number; vx: number; vy: number } | null = null;
    inclinador.current.calibrar();
    Accelerometer.setUpdateInterval(SACUDIDA.intervaloSensorMs);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      // Hélice proporcional al movimiento vertical; se manda a lo sumo cada SACUDIDA.envioMs.
      const nivel = volarSaltando ? vuelo.muestra(x, y, z) : 0;
      const ahora = Date.now();
      if (nivel !== ultimoNivel && ahora - ultimoEnvio >= SACUDIDA.envioMs) {
        ultimoNivel = nivel;
        ultimoEnvio = ahora;
        client.setHeliceMovimiento(nivel);
      }
      // Mientras se sacude para volar, las lecturas del acelerómetro no sirven para medir la inclinación: no se le pasan al
      // filtro y se mantiene la última inclinación válida, así se puede avanzar/girar y volar al mismo tiempo.
      const sacudiendo = volarSaltando && vuelo.activo;
      const inc = sacudiendo ? ultimaInc : inclinador.current.muestra(x, y, z, Date.now());
      if (!sacudiendo && inc) ultimaInc = inc;
      if (inc) {
        if (inclinacion) client.setInclinacion(inc.traction, inc.steering);
        burbuja.setValue({ x: inc.vx, y: -inc.vy });
        setCelda(celdaDe(inc.vx, inc.vy)); // solo re-renderiza cuando cambia de celda
      }
    });
    return () => {
      sub.remove();
      client.setInclinacion(0, 0);
      client.setHeliceMovimiento(0);
      burbuja.setValue({ x: 0, y: 0 });
      setCelda(4);
    };
  }, [client, volarSaltando, inclinacion, burbuja]);

  useEffect(() => {
    const sim = new AlturaSimulada();
    let ultimo = Date.now();
    const id = setInterval(() => {
      const ahora = Date.now();
      alturaAnim.setValue(sim.paso(heliceRef.current, (ahora - ultimo) / 1000));
      ultimo = ahora;
    }, 33);
    return () => clearInterval(id);
  }, [alturaAnim]);

  // Fin de la conexión: borrar el token si corresponde y, si fue el botón Desconectar, volver al inicio.
  useEffect(() => {
    if (!snap.fin) return;
    if (snap.fin.borrarToken && !porBle) borrarSesion();
    if (snap.fin.codigo === 'salio') onSalir('inicio');
  }, [snap.fin, onSalir, porBle]);

  // Robot Bluetooth que conectó bien: se recuerda para reconectar con un toque.
  useEffect(() => {
    if (canal?.tipo === 'ble' && snap.estado === 'conectado') guardarRobotBle(canal.robot);
  }, [canal, snap.estado]);

  // Avisos cortos: error no fatal y nombre rechazado.
  const robotId = snap.robot?.id;
  useEffect(() => {
    if (snap.robot?.nameRejected) mostrarToast(t('nombreRechazado', { nombre: snap.robot.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotId]);
  useEffect(() => {
    if (snap.aviso) mostrarToast(snap.aviso.texto);
  }, [snap.aviso]);

  const timerToast = useRef<ReturnType<typeof setTimeout> | null>(null);
  function mostrarToast(texto: string) {
    setToast(texto);
    if (timerToast.current) clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToast(null), 3000);
  }
  useEffect(() => () => {
    if (timerToast.current) clearTimeout(timerToast.current);
  }, []);

  // Multitouch real: cada evento recalcula qué botones tienen algún dedo encima.
  function alTocar(e: GestureResponderEvent) {
    const ahora: Record<Tecla, boolean> = { ...NINGUNO };
    for (const toque of e.nativeEvent.touches) {
      for (const b of BOTONES) {
        const r = rects[b];
        if (toque.locationX >= r.x && toque.locationX <= r.x + r.w && toque.locationY >= r.y && toque.locationY <= r.y + r.h) ahora[b] = true;
      }
    }
    const inc = instr.inclinar;
    const enInc = e.nativeEvent.touches.some((q) => q.locationX >= inc.x && q.locationX <= inc.x + inc.w && q.locationY >= inc.y && q.locationY <= inc.y + inc.h);
    if (enInc !== incPrevio.current) {
      incPrevio.current = enInc;
      if (enInc) alternarInclinacion();
    }
    let cambio = false;
    for (const b of BOTONES) {
      if (ahora[b] === previo.current[b]) continue;
      cambio = true;
      if (ACCIONES.includes(b as Accion)) {
        // Accesorios: se accionan al apoyar el dedo (LED y espada alternan; el buzzer suena 1 s).
        if (ahora[b]) {
          if (b === 'led') client.alternarLed();
          else if (b === 'espada') client.alternarEspada();
          else client.sonarBuzzer();
        }
      } else {
        client.setBoton(b as Boton, ahora[b]);
      }
      if (ahora[b]) Haptics.selectionAsync().catch(() => {});
    }
    if (cambio) {
      previo.current = ahora;
      setApretados(ahora);
    }
  }

  heliceRef.current = snap.helice;
  const acento = snap.robot?.color ?? colores.acento;
  const textoAcento = textoSobre(acento);
  const estadoColor = snap.estado === 'conectado' ? colores.ok : snap.estado === 'terminado' ? colores.peligro : colores.aviso;
  const estadoTexto =
    snap.estado === 'conectado' ? t('conectado') : snap.estado === 'reconectando' ? t('reconectando') : snap.estado === 'conectando' ? t('conectando') : t('sinConexion');
  const mostrarFin = snap.fin && snap.fin.codigo !== 'salio';
  const enCurso = snap.estado === 'conectando' || snap.estado === 'reconectando';

  return (
    <View style={[styles.pantalla, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.cabecera}>
        <Text style={styles.cabeceraTexto} accessibilityRole="header">
          {t('appNombre')}
        </Text>
      </View>
      <View style={styles.barra}>
        <View style={styles.izquierda}>
          <View style={styles.robot}>
            <View style={[styles.circulo, { backgroundColor: acento }]} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={styles.robotNombre} numberOfLines={1}>
              {snap.robot ? snap.robot.name : t('appNombre')}
            </Text>
          </View>
          <View style={styles.estado} accessible accessibilityLabel={estadoTexto}>
            <View style={[styles.punto, { backgroundColor: estadoColor }]} />
            <Text style={styles.estadoTexto}>{estadoTexto}</Text>
            {!porBle && snap.pingMs != null && snap.estado === 'conectado' && <Text style={styles.ping}>{t('pingMs', { ms: snap.pingMs })}</Text>}
          </View>
        </View>
        <View style={styles.acciones}>
        <Pressable
          style={styles.salir}
          onPress={() => {
            inclinador.current.calibrar();
            Haptics.selectionAsync().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={t('calibrar')}
          hitSlop={8}
        >
          <Text style={styles.salirTexto}>⟲ {t('calibrar')}</Text>
        </Pressable>
        <Pressable style={styles.salir} onPress={() => client.salir()} accessibilityRole="button" accessibilityLabel={t('desconectar')} hitSlop={8}>
          <Text style={styles.salirTexto}>✕ {t('salir')}</Text>
        </Pressable>
        </View>
      </View>

      <View
        style={styles.area}
        onLayout={(e: LayoutChangeEvent) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onTouchStart={alTocar}
        onTouchMove={alTocar}
        onTouchEnd={alTocar}
        onTouchCancel={alTocar}
      >
        {tam.w > 0 && (
          <View
            pointerEvents="none"
            accessible
            accessibilityRole="switch"
            accessibilityState={{ checked: inclinacion }}
            accessibilityLabel={t('manejarInclinando')}
            style={[styles.botonInclinar, { left: instr.inclinar.x, top: instr.inclinar.y, width: instr.inclinar.w, height: instr.inclinar.h }, inclinacion && { backgroundColor: acento, borderColor: acento }]}
          >
            <Text style={[styles.btnInclinarTexto, inclinacion && { color: textoAcento }]} numberOfLines={1}>
              📱 {t('manejarInclinando')}: {inclinacion ? 'ON' : 'OFF'}
            </Text>
          </View>
        )}
        {tam.w > 0 && instr.nivel && <Nivel pos={burbuja} celda={celda} color={inclinacion ? acento : colores.textoSuave} ancho={instr.nivel.w} alto={instr.nivel.h} x={instr.nivel.x} y={instr.nivel.y} />}
        {tam.w > 0 && <PanelAltura altura={alturaAnim} color={acento} x={instr.panelAltura.x} y={instr.panelAltura.y} alto={instr.panelAltura.h} />}
        {tam.w > 0 &&
          BOTONES.map((b) => {
            const r = rects[b];
            // Encendido: dedo encima, o accesorio activo (LED, espada, buzzer sonando).
            const activo = (b === 'led' && snap.led) || (b === 'espada' && snap.espada) || (b === 'buzzer' && snap.buzzer);
            const on = apretados[b] || activo;
            return (
              <View
                key={b}
                pointerEvents="none"
                accessible
                accessibilityRole="button"
                accessibilityLabel={t(ETIQUETAS[b].clave)}
                style={[
                  styles.boton,
                  { left: r.x, top: r.y, width: r.w, height: r.h },
                  b === 'stop' && { borderColor: colores.peligro },
                  on && (b === 'stop' ? { backgroundColor: colores.peligro, borderColor: colores.peligro } : { backgroundColor: acento, borderColor: acento }),
                ]}
              >
                <Text style={[styles.icono, b === 'stop' && { color: colores.peligro }, on && { color: b === 'stop' ? '#06101f' : textoAcento }]}>{ETIQUETAS[b].icono}</Text>
                <Text style={[styles.etiqueta, b === 'stop' && { color: colores.peligro, fontWeight: '800' }, on && { color: b === 'stop' ? '#06101f' : textoAcento }]} numberOfLines={2}>
                  {t(ETIQUETAS[b].clave)}
                </Text>
              </View>
            );
          })}
      </View>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastTexto}>{toast}</Text>
        </View>
      )}

      {!canal && (
        <View style={styles.velo}>
          <View style={styles.tarjeta}>
            <Text style={styles.finTitulo}>{t('elegirCanal')}</Text>
            <Pressable style={[styles.opcionCanal, { backgroundColor: colores.acento }]} onPress={onEscanear} accessibilityRole="button">
              <Text style={[styles.opcionTitulo, { color: colores.textoSobreAcento }]}>📷 {t('conectarQr')}</Text>
              <Text style={[styles.opcionAyuda, { color: colores.textoSobreAcento }]}>{t('conectarQrAyuda')}</Text>
            </Pressable>
            <Pressable style={[styles.opcionCanal, { backgroundColor: colores.acento }]} onPress={onBluetooth} accessibilityRole="button">
              <Text style={[styles.opcionTitulo, { color: colores.textoSobreAcento }]}>🔵 {t('conectarBle')}</Text>
              <Text style={[styles.opcionAyuda, { color: colores.textoSobreAcento }]}>{t('conectarBleAyuda')}</Text>
            </Pressable>
            {robotBleGuardado && (
              <Pressable style={styles.btnFin} onPress={() => onReconectarBle(robotBleGuardado)} accessibilityRole="button">
                <Text style={styles.btnFinTexto} numberOfLines={1}>
                  ↻ {t('reconectarRobot', { nombre: robotBleGuardado.nombre })}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {canal && enCurso && !mostrarFin && (
        <View style={styles.velo}>
          <Text style={styles.veloTitulo}>{snap.estado === 'reconectando' ? t('reconectando') : t('conectando')}</Text>
        </View>
      )}

      {mostrarFin && snap.fin && (
        <View style={styles.velo}>
          <View style={styles.tarjeta}>
            <Text style={styles.finTitulo}>{t('finTitulo')}</Text>
            <Text style={styles.finTexto}>{textoFin(snap.fin)}</Text>
            <View style={styles.finBotones}>
              <Pressable
                style={[styles.btnFin, { backgroundColor: colores.acento }]}
                onPress={() => onSalir(snap.fin!.borrarToken ? 'escanear' : 'reintentar')}
                accessibilityRole="button"
              >
                <Text style={[styles.btnFinTexto, { color: colores.textoSobreAcento }]}>
                  {snap.fin.borrarToken ? t('escanearOtraVez') : t('reintentar')}
                </Text>
              </Pressable>
              <Pressable style={styles.btnFin} onPress={() => onSalir('inicio')} accessibilityRole="button">
                <Text style={styles.btnFinTexto}>{t('alInicio')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  cabecera: { alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 },
  cabeceraTexto: { color: colores.texto, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  barra: { height: BARRA, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: MARGEN, gap: 8 },
  izquierda: { flexShrink: 1, gap: 4 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonInclinar: { position: 'absolute', borderRadius: radio.chico, backgroundColor: colores.superficie, borderColor: colores.borde, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnInclinarTexto: { color: colores.texto, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  robot: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  circulo: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colores.texto },
  robotNombre: { color: colores.texto, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 12, height: 12, borderRadius: 6 },
  estadoTexto: { color: colores.texto, fontSize: 14 },
  ping: { color: colores.textoSuave, fontSize: 12 },
  salir: { backgroundColor: colores.superficieAlta, borderRadius: radio.chico, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  salirTexto: { color: colores.texto, fontSize: 14, fontWeight: '600' },
  area: { flex: 1 },
  boton: {
    position: 'absolute',
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderWidth: 3,
    borderRadius: radio.boton,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  icono: { color: colores.texto, fontSize: 40 },
  etiqueta: { color: colores.textoSuave, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  toast: { position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: colores.superficieAlta, borderRadius: radio.chico, paddingHorizontal: 16, paddingVertical: 8, maxWidth: '70%' },
  toastTexto: { color: colores.texto, fontSize: 14, textAlign: 'center' },
  velo: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(11,18,32,0.85)', alignItems: 'center', justifyContent: 'center' },
  veloTitulo: { color: colores.texto, fontSize: 24, fontWeight: '700' },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: radio.tarjeta, padding: 20, maxWidth: 520, width: '80%', gap: 12 },
  finTitulo: { color: colores.texto, fontSize: 20, fontWeight: '700' },
  finTexto: { color: colores.texto, fontSize: 16 },
  finBotones: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnFin: { flex: 1, minHeight: 48, borderRadius: radio.chico, backgroundColor: colores.superficieAlta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  opcionCanal: { minHeight: 72, borderRadius: radio.boton, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  opcionTitulo: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  opcionAyuda: { fontSize: 14, textAlign: 'center' },
  btnFinTexto: { color: colores.texto, fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
