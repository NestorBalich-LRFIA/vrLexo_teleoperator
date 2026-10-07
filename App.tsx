import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { textoErrorQr } from './src/i18n';
import { parseJoinUrl } from './src/qr/parseJoinUrl';
import AvisoActualizacion from './src/screens/AvisoActualizacion';
import BuscarRobot from './src/screens/BuscarRobot';
import type { RobotBle } from './src/net/BleSocket';
import type { Canal } from './src/net/canal';
import Control, { DestinoSalida } from './src/screens/Control';
import PedirNombre from './src/screens/PedirNombre';
import Help from './src/screens/Help';
import Home from './src/screens/Home';
import Scan from './src/screens/Scan';
import {
  Sesion,
  guardarNombre,
  guardarSesion,
  guardarInclinacion,
  guardarVolarSaltando,
  leerInclinacion,
  leerNombre,
  leerRobotBle,
  leerSesion,
  leerVolarSaltando,
  obtenerDeviceId,
} from './src/storage';
import { View } from 'react-native';
import { Actualizacion, consultarVersion } from './src/update/actualizacion';
import { colores } from './src/theme';

/** 'control' es la pantalla de entrada; 'inicio' queda como "Opciones" (pegar enlace, volver a entrar, ayuda). */
type Pantalla = 'inicio' | 'escanear' | 'ayuda' | 'control' | 'bluetooth' | 'nombre';

/** Android 15 dibuja la app bajo las barras del sistema: se respetan los márgenes seguros (barra de estado, cámara, navegación). */
export default function App() {
  return (
    <SafeAreaProvider>
      <Aplicacion />
    </SafeAreaProvider>
  );
}

function Aplicacion() {
  const insets = useSafeAreaInsets();
  const [pantalla, setPantalla] = useState<Pantalla>('control');
  const [listo, setListo] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [nombre, setNombre] = useState('');
  const [volarSaltando, setVolarSaltando] = useState(true);
  const [inclinacion, setInclinacion] = useState(false);
  const [sesionGuardada, setSesionGuardada] = useState<Sesion | null>(null);
  const [porNombrar, setPorNombrar] = useState<Sesion | null>(null);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [robotBle, setRobotBle] = useState<RobotBle | null>(null);
  const [claveControl, setClaveControl] = useState(0);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const ayudaDesde = useRef<'inicio' | 'escanear' | 'bluetooth'>('inicio');
  const nombreRef = useRef('');
  nombreRef.current = nombre;

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const versionCodeLocal = Constants.expoConfig?.android?.versionCode ?? 0;

  // Actualización: se consulta version.json al abrir y al entrar al escáner; si hay una versión mayor se avisa al escanear.
  const [actualizacion, setActualizacion] = useState<Actualizacion | null>(null);
  const [pendiente, setPendiente] = useState<{ sesion: Sesion; act: Actualizacion } | null>(null);
  const consultaVersion = useRef<Promise<Actualizacion | null>>(Promise.resolve(null));
  const ignorada = useRef(false); // el alumno ya eligió "Continuar igual" en esta ejecución
  const revisarVersion = useCallback(() => {
    consultaVersion.current = consultarVersion(versionCodeLocal).then((a) => {
      setActualizacion(a);
      return a;
    });
  }, [versionCodeLocal]);
  useEffect(() => {
    revisarVersion();
  }, [revisarVersion]);

  useEffect(() => {
    (async () => {
      const [id, n, v, s, inc, rb] = await Promise.all([obtenerDeviceId(), leerNombre(), leerVolarSaltando(), leerSesion(), leerInclinacion(), leerRobotBle()]);
      setDeviceId(id);
      setNombre(n);
      setVolarSaltando(v);
      setSesionGuardada(s);
      setRobotBle(rb);
      setInclinacion(inc);
      setListo(true);
    })();
  }, []);

  /** Con el QR ya leído: se pregunta el nombre del robot y recién ahí se conecta. */
  const entrar = useCallback((s: Sesion) => {
    setPorNombrar(s);
    setPantalla('nombre');
  }, []);

  const conectarQr = useCallback((s: Sesion, n: string) => {
    guardarSesion(s);
    guardarNombre(n);
    setNombre(n);
    nombreRef.current = n;
    setSesionGuardada(s);
    setCanal({ tipo: 'qr', sesion: s });
    setMensaje(null);
    setClaveControl((k) => k + 1);
    setPantalla('control');
  }, []);

  /** Antes de conectar: si hay una versión nueva (se espera hasta 2,5 s a la consulta), se avisa. */
  const entrarConAviso = useCallback(
    async (s: Sesion) => {
      const act = await Promise.race([consultaVersion.current, new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
      if (act && !ignorada.current) setPendiente({ sesion: s, act });
      else entrar(s);
    },
    [entrar],
  );

  // App Link (https://vr.lexodive.com/app/#s=…&t=…) o vrlexo://join?s=…&t=…: abre la app y conecta.
  const alEnlace = useCallback(
    (url: string | null) => {
      if (!url) return;
      const r = parseJoinUrl(url);
      if (r.ok) entrarConAviso({ url: r.url, token: r.token });
      else {
        setMensaje(textoErrorQr(r.error));
        setPantalla('inicio');
      }
    },
    [entrarConAviso],
  );

  useEffect(() => {
    if (!listo) return;
    Linking.getInitialURL().then(alEnlace).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => alEnlace(url));
    return () => sub.remove();
  }, [listo, alEnlace]);

  const entrarPorBle = useCallback((r: RobotBle) => {
    setRobotBle(r);
    setCanal({ tipo: 'ble', robot: r });
    setMensaje(null);
    setClaveControl((k) => k + 1);
    setPantalla('control');
  }, []);

  // Vertical en todas las pantallas menos en el control (que se bloquea apaisado por su cuenta).
  useEffect(() => {
    if (pantalla !== 'control') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [pantalla]);

  // Botón atrás de Android.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pantalla === 'ayuda') {
        setPantalla(ayudaDesde.current);
        return true;
      }
      if (pantalla !== 'control') {
        setPantalla('control');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pantalla]);

  const salirDeControl = useCallback(
    async (destino: DestinoSalida) => {
      if (destino === 'reintentar') {
        setClaveControl((k) => k + 1);
        return;
      }
      setSesionGuardada(await leerSesion());
      setNombre(await leerNombre());
      if (destino === 'escanear') return setPantalla('escanear');
      // "Inicio": se vuelve al panel de elección de conexión.
      setCanal(null);
      setClaveControl((k) => k + 1);
      setPantalla('control');
    },
    [],
  );

  if (!listo) return <View style={{ flex: 1, backgroundColor: colores.fondo }} />;

  return (
    <>
      <StatusBar style="light" />
      {pantalla === 'inicio' && (
        <View style={{ flex: 1, backgroundColor: colores.fondo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Home
          sesionGuardada={sesionGuardada}
          mensaje={mensaje}
          version={version}
          actualizacion={actualizacion}
          onActualizar={() => {
            if (actualizacion) Linking.openURL(actualizacion.url).catch(() => {});
          }}
          onEscanear={() => {
            revisarVersion();
            setMensaje(null);
            setPantalla('escanear');
          }}
          onConectar={entrarConAviso}
          onAyuda={() => {
            ayudaDesde.current = 'inicio';
            setPantalla('ayuda');
          }}
          onVolver={() => setPantalla('control')}
        />
        </View>
      )}
      {pantalla === 'escanear' && (
        <Scan onLeido={entrarConAviso} onPegar={() => setPantalla('inicio')}
          onVolver={() => setPantalla('control')}
          sesionGuardada={sesionGuardada}
          onVolverAEntrar={entrarConAviso}
          onAyuda={() => {
            ayudaDesde.current = 'escanear';
            setPantalla('ayuda');
          }}
        />
      )}
      {pantalla === 'nombre' && porNombrar && (
        <View style={{ flex: 1, backgroundColor: colores.fondo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <PedirNombre nombreInicial={nombre} onConfirmar={(n) => conectarQr(porNombrar, n)} onCancelar={() => setPantalla('control')} />
        </View>
      )}
      {pantalla === 'bluetooth' && (
        <View style={{ flex: 1, backgroundColor: colores.fondo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <BuscarRobot
            onElegido={entrarPorBle}
            onVolver={() => setPantalla('control')}
            onAyuda={() => {
              ayudaDesde.current = 'bluetooth';
              setPantalla('ayuda');
            }}
          />
        </View>
      )}
      {pantalla === 'ayuda' && (
        <View style={{ flex: 1, backgroundColor: colores.fondo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <Help version={version} tema={ayudaDesde.current === 'bluetooth' ? 'ble' : 'qr'} onVolver={() => setPantalla(ayudaDesde.current)} />
        </View>
      )}
      {pantalla === 'control' && (
        <Control
          key={claveControl}
          canal={canal}
          robotBleGuardado={robotBle}
          onEscanear={() => {
            revisarVersion();
            setMensaje(null);
            setPantalla('escanear');
          }}
          onBluetooth={() => setPantalla('bluetooth')}
          onReconectarBle={entrarPorBle}
          nombre={nombreRef.current}
          deviceId={deviceId}
          volarSaltando={volarSaltando}
          inclinacion={inclinacion}
          onSalir={salirDeControl}
        />
      )}
      {pendiente && (
        <AvisoActualizacion
          actualizacion={pendiente.act}
          versionActual={version}
          onActualizar={() => {
            // Se guarda el QR para poder "Volver a entrar" después de actualizar.
            guardarSesion(pendiente.sesion);
            setSesionGuardada(pendiente.sesion);
            Linking.openURL(pendiente.act.url).catch(() => {});
            setPendiente(null);
            setPantalla('inicio');
          }}
          onContinuar={() => {
            ignorada.current = true;
            const s = pendiente.sesion;
            setPendiente(null);
            entrar(s);
          }}
        />
      )}
    </>
  );
}
