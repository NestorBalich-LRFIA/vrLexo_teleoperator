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
import Control, { DestinoSalida } from './src/screens/Control';
import Help from './src/screens/Help';
import Home from './src/screens/Home';
import Scan from './src/screens/Scan';
import {
  Sesion,
  guardarSesion,
  guardarInclinacion,
  guardarVolarSaltando,
  leerInclinacion,
  leerNombre,
  leerSesion,
  leerVolarSaltando,
  obtenerDeviceId,
} from './src/storage';
import { View } from 'react-native';
import { Actualizacion, consultarVersion } from './src/update/actualizacion';
import { colores } from './src/theme';

type Pantalla = 'inicio' | 'escanear' | 'ayuda' | 'control';

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
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [listo, setListo] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [nombre, setNombre] = useState('');
  const [volarSaltando, setVolarSaltando] = useState(true);
  const [inclinacion, setInclinacion] = useState(false);
  const [sesionGuardada, setSesionGuardada] = useState<Sesion | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [claveControl, setClaveControl] = useState(0);
  const [mensaje, setMensaje] = useState<string | null>(null);
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
      const [id, n, v, s, inc] = await Promise.all([obtenerDeviceId(), leerNombre(), leerVolarSaltando(), leerSesion(), leerInclinacion()]);
      setDeviceId(id);
      setNombre(n);
      setVolarSaltando(v);
      setSesionGuardada(s);
      setInclinacion(inc);
      setListo(true);
    })();
  }, []);

  const entrar = useCallback((s: Sesion) => {
    guardarSesion(s);
    setSesionGuardada(s);
    setSesion(s);
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

  // Vertical en todas las pantallas menos en el control (que se bloquea apaisado por su cuenta).
  useEffect(() => {
    if (pantalla !== 'control') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [pantalla]);

  // Botón atrás de Android.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pantalla === 'escanear' || pantalla === 'ayuda') {
        setPantalla('inicio');
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
      setPantalla(destino === 'escanear' ? 'escanear' : 'inicio');
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
          nombre={nombre}
          onNombre={setNombre}
          volarSaltando={volarSaltando}
          onVolarSaltando={(v) => {
            setVolarSaltando(v);
            guardarVolarSaltando(v);
          }}
          inclinacion={inclinacion}
          onInclinacion={(v) => {
            setInclinacion(v);
            guardarInclinacion(v);
          }}
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
          onAyuda={() => setPantalla('ayuda')}
        />
        </View>
      )}
      {pantalla === 'escanear' && <Scan onLeido={entrarConAviso} onPegar={() => setPantalla('inicio')} onVolver={() => setPantalla('inicio')} />}
      {pantalla === 'ayuda' && (
        <View style={{ flex: 1, backgroundColor: colores.fondo, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <Help version={version} onVolver={() => setPantalla('inicio')} />
        </View>
      )}
      {pantalla === 'control' && sesion && (
        <Control
          key={claveControl}
          sesion={sesion}
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
