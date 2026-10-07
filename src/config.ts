// Toda la configuración de la app en un solo lugar (hosts, velocidades, tiempos, sacudida, descarga).

/** Identificador de la app Android (debe coincidir con app.json y con assetlinks.json). */
export const APPLICATION_ID = 'vrlexo.control';

/** Hosts permitidos para el QR en producción. Para cambiarlo, ver README ("Cambiar el host permitido"). */
export const HOSTS_PERMITIDOS: string[] = ['vr.lexodive.com'];

/** Solo en debug (`__DEV__`): además de HOSTS_PERMITIDOS se aceptan estos y cualquier IP local privada. */
export const HOSTS_DEBUG: string[] = ['localhost', '127.0.0.1'];

/** Prefijo de ruta del App Link: https://<host>/app/#s=...&t=... */
export const PATH_APP = '/app/';

/** Esquema propio de respaldo: vrlexo://join?s=...&t=... */
export const ESQUEMA_PROPIO = 'vrlexo';
export const HOST_ESQUEMA_PROPIO = 'join';

/** Página de descarga del APK (la mantiene el repo del simulador). */
export const URL_DESCARGA_APK = 'https://vr.lexodive.com/app/vrlexo-control.apk';
export const URL_PAGINA_APP = 'https://vr.lexodive.com/app/';

/** Velocidad de los botones de movimiento (−100..100). */
export const SPEED = 70;

/** Cada cuánto se reenvía el comando mientras haya algún botón apretado (el watchdog del servidor es 300 ms). */
export const INTERVALO_ENVIO_MS = 50;

/** Espera entre reintentos al cortarse la red: 1 s, 2 s, 4 s y después siempre 8 s. */
export const BACKOFF_MS: number[] = [1000, 2000, 4000, 8000];

/** Latido (PING) y tiempo máximo esperando EXT_READY tras el EXT_HELLO. */
export const PING_INTERVALO_MS = 5000;
export const HELLO_TIMEOUT_MS = 12000;

/** Parámetros del EXT_HELLO. */
export const HZ_ESTADO = 2;
export const WATCHDOG_MS = 300;
export const MAX_NOMBRE = 20;

/**
 * Idioma de la app. `"es"` = siempre español (lo pedido en el encargo); `null` = seguir el idioma del sistema
 * (es, en o pt; si no está soportado, español). Las traducciones en/pt están en src/i18n/.
 */
export const IDIOMA_FORZADO: string | null = 'es';

/** Hélice encendida / apagada (ROBOT_SET.helice). */
export const HELICE_ON = 100;

/**
 * Volar moviendo el celular rápido hacia arriba y abajo (acelerómetro, en g): la hélice es proporcional a la
 * aceleración vertical (más rápido = más alto) y baja sola al parar.
 */
export const SACUDIDA = {
  /** Aceleración vertical (g sobre la gravedad) que ya empieza a dar hélice. Bajo para que un movimiento chico pero rápido ya vuele. */
  minG: 0.2,
  /** Aceleración vertical con la que la hélice llega a 100. */
  maxG: 1.2,
  /** Suavizado para separar la gravedad del movimiento (0..1; bajo = la gravedad se mueve más lento). */
  filtroGravedad: 0.05,
  /** Cuánto cae la envolvente en cada muestra (0.9 ≈ medio segundo hasta apagarse). */
  decaimiento: 0.9,
  /** Cuánto de la aceleración lateral se resta a la vertical (0 = ignorar la lateral; 1 = solo cuenta si es casi puramente vertical). */
  penalLateral: 1,
  /** Con la envolvente por encima de esta fracción de minG se considera que está sacudiendo: la inclinación se anula. */
  umbralActivoFraccion: 0.6,
  /** Cada cuánto se manda un cambio de hélice (el servidor admite 60 mensajes/s en total). */
  envioMs: 100,
  /** Intervalo del acelerómetro (~50 Hz). */
  intervaloSensorMs: 20,
};

/** Altura simulada del robot para la barra (unidades: 1 = tope de la barra). La altura real no llega a la app. */
export const ALTURA = {
  /** Aceleración hacia arriba con la hélice al 100 %. */
  empuje: 2.0,
  /** Aceleración de caída (con la hélice a 25 % se queda flotando). */
  gravedad: 0.5,
  /** Frena la velocidad: velocidad máxima = (empuje − gravedad) / arrastre. */
  arrastre: 1.5,
};

/** Manejar inclinando el celular (acelerómetro). Girar el celular como un volante = girar; inclinar arriba/abajo = avanzar/retroceder. */
export const INCLINACION = {
  /** Grados sin efecto alrededor del punto neutro (evita temblor). Debe ser maxGrados/3: así el cuadro de 3x3 coincide con la orden real. */
  zonaMuertaGrados: 15,
  /** Grados a los que se llega a la velocidad máxima (SPEED). */
  maxGrados: 45,
  /** Suavizado del sensor (0..1; más bajo = más lento): un movimiento rápido no llega a mover el robot, hay que inclinar despacio. */
  filtro: 0.12,
  /** Si la magnitud total sale de este rango el celular se está sacudiendo/saltando y se ignora la muestra. */
  gMin: 0.85,
  gMax: 1.15,
  /** Si el celular no responde en el sentido esperado, invertir acá (sin tocar el código). */
  invertirGiro: false,
  invertirAvance: false,
};

/** Vibración corta al apretar un botón. */
export const VIBRACION_MS = 15;
