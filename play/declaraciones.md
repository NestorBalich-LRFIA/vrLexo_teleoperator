# Declaraciones para Play Console (respuestas listas para copiar)

Basadas en lo que hace la app hoy (`app.json` y el código). Revisalas antes de enviar: Play es el que decide.

## Datos de la app
- **Nombre:** LexoDive VR Controller · **Paquete:** `com.lexodive.vrcontroller`
- **Categoría:** Educación (alternativa: Herramientas). **Tipo:** App, gratuita. **Sin anuncios.** **Sin compras dentro de la app.**
- **Contacto del desarrollador:** lexodive@gmail.com (el que figura en las Condiciones de Uso del simulador). Sitio web: https://vr.lexodive.com

## Seguridad de los datos (Data safety)
La app no tiene cuentas, anuncios ni analíticas. Solo manda datos al servidor del simulador (conexión QR) y no al modo Bluetooth.

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos? | Sí (solo en modo QR, hacia el servidor del simulador) |
| ¿Datos cifrados en tránsito? | Sí (en producción solo acepta `wss://`) |
| ¿Se puede pedir que se borren? | No se guardan cuentas; el robot se quita al salir. Indicar el contacto de arriba |
| **Info personal → Nombre** | Recopilado: el apodo opcional del robot (máx. 20 letras). No compartido con terceros. Finalidad: funcionalidad de la app. Opcional |
| **Identificadores → ID de dispositivo u otros** | Recopilado: un UUID aleatorio generado por la app (no es el IMEI ni el ID de publicidad). No compartido. Finalidad: funcionalidad (recuperar el mismo robot tras un corte) |
| Ubicación, contactos, fotos, audio, archivos, historial, finanzas, salud | No recopila |
| Cámara | Solo para leer el QR en el momento; **no se guarda ni se envía ninguna imagen** |

- El nombre del robot y el UUID los **procesa el servidor del simulador** (vr.lexodive.com), que es del mismo desarrollador: se declaran como recopilados, no como "compartidos con terceros".
- Si la política de privacidad del simulador cubre estos datos, enlazarla (ver abajo).

## Permisos (declaración y justificación)
| Permiso | Para qué | ¿Pide permiso en pantalla? |
|---|---|---|
| `CAMERA` | Leer el código QR para conectar al simulador. No graba ni guarda imágenes | Sí |
| `BLUETOOTH_SCAN` (con `neverForLocation`) | Buscar el robot físico cercano | Sí (Android 12+) |
| `BLUETOOTH_CONNECT` | Conectarse al robot elegido y mandarle los comandos | Sí (Android 12+) |
| `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE/COARSE_LOCATION` | Solo Android 11 o menor (el sistema los exige para escanear BLE; `maxSdkVersion=30`). La app **no usa la ubicación** | Sí (ubicación, solo Android ≤11) |
| `INTERNET` | Hablar con el servidor del simulador | No |
| `HIGH_SAMPLING_RATE_SENSORS` | Acelerómetro a alta frecuencia para manejar inclinando y volar sacudiendo (sin esto Android 12+ lo limita a ~5 Hz) | No |
| `VIBRATE` | Vibración corta al apretar un botón | No |

La app declara además que **quita** `RECORD_AUDIO`, `ACTIVITY_RECOGNITION`, `READ/WRITE_EXTERNAL_STORAGE` y `SYSTEM_ALERT_WINDOW`.
Ninguno de los permisos usados es de acceso restringido (no requiere formularios especiales).

## Acceso a la app (instrucciones para el revisor de Play)
La app no tiene login, pero **todo requiere un QR o un robot**, y el revisor no los tiene. En "Acceso a la app → instrucciones" conviene escribir
(completar con datos reales):

> La app abre directo en el control. Para conectar hay dos opciones: "Conectar con QR" (necesita el código QR que genera el simulador en https://vr.lexodive.com al activar la conexión remota) y "Conectar por Bluetooth" (necesita un robot compatible cercano).
> Para revisar: [pasos/enlace de prueba o video que muestre el flujo completo]. Ejemplo de enlace de conexión: https://vr.lexodive.com/app/#s=<wss>&t=<token>.

⚠️ Hace falta preparar un QR/enlace de prueba que no venza o un **video corto** (YouTube no listado) mostrando el flujo; sin eso el revisor puede rechazar la app por "no se puede probar".

## Clasificación de contenido (cuestionario IARC)
Sin violencia gráfica, sin contenido sexual, sin lenguaje fuerte, sin sustancias, sin apuestas, sin interacción entre usuarios ni compartir ubicación. Resultado esperado: apta para todo público.
(La "espada" es un accesorio del robot de simulación, sin sangre ni daño.)

## Público objetivo y contenido
- Es una herramienta **para el aula**. Si el público incluye **menores de 13 años**, Play aplica la política **"Diseñada para familias"**: no hay anuncios ni analíticas, lo cual ayuda, pero hay que revisar la política de privacidad y cómo se piden los datos. **Decisión pendiente tuya:** rango de edad (recomendado declarar 13+ o "todas las edades" según el caso real).
- ¿Es una app de noticias, de salud o financiera? No. ¿Usa VpnService o similares? No.

## Política de privacidad (obligatoria)
Play exige una **URL pública** de política de privacidad. El simulador ya tiene Política de Privacidad (versión 1.0, la aceptan los alumnos al ingresar), pero **no encontré una URL pública fija**. Hay que publicarla (por ejemplo `https://vr.lexodive.com/privacidad`) y pegarla en la ficha. Debe decir, como mínimo: qué datos usa la app (apodo del robot y un UUID aleatorio), que la cámara solo lee el QR sin guardar imágenes, que Bluetooth solo se usa para hablar con el robot y quién es el responsable (con contacto).
