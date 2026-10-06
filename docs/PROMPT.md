# Prompt para la IA que desarrolla la app Android "VR Lexo Control"

> Este documento es el encargo completo de la app. El servidor del simulador YA está implementado (protocolo final, abajo).
> Lo marcado **[A CONFIRMAR]** puede cambiar: dejalo en constantes/config, no desparramado por el código.

---

## Rol y objetivo

Sos un desarrollador senior de React Native. Construí una app **Android** llamada **"VR Lexo Control"**:
un control remoto (tipo gamepad) para manejar **un robot** dentro del simulador web **VR Lexo**
(https://vr.lexodive.com). Es para alumnos de escuela: simple, botones grandes, textos claros en español
(con i18n preparado para en/pt) y que ande bien en celulares modestos.

## Cómo funciona el sistema (contexto)

- Un usuario con la conexión remota habilitada tiene el simulador abierto en el navegador y muestra un **código QR**.
- La app es **un programa externo más conectado a esa sesión** (igual que los programas Python/Colab que ya se
  conectan): usa el mismo WebSocket y el mismo protocolo `EXT_*`. No hay login en la app: la identidad es el
  **token del QR** y el nombre que el alumno escribe.
- Hasta **10 celulares** a la vez; cada uno controla **un robot distinto**. El servidor crea el robot del celular
  al conectarse (o le da el robot principal si está libre) y lo quita cuando el celular se desconecta.

## Requisitos funcionales

1. **Escanear QR** (cámara) para conectarse (ver "Un solo QR").
2. Antes de conectar, pantalla con un campo **"Nombre del robot"** (máx. 20 caracteres). Si lo deja vacío, no se manda
   `name` y el servidor asigna uno por defecto ("Robot 1", "Robot 2"…). Recordar el último nombre usado como sugerencia editable.
3. **Pantalla de control** (apaisada/landscape, bloqueada, pantalla siempre encendida):
   - Izquierda: botones grandes **▲ Adelante** y **▼ Atrás**.
   - Derecha: botones grandes **◀ Girar izquierda** y **▶ Girar derecha**.
   - Centro/abajo: botón **🚁 Volar** (mantener apretado = hélice encendida; soltar = apagada).
   - **Volar también saltando con el celular en la mano**: detectar el salto con el acelerómetro (`expo-sensors`
     `Accelerometer`, ~50 Hz): cuando la magnitud de la aceleración total supera un umbral (~1,8 g) tras un instante
     cercano a caída libre, se manda `helice:100` durante ~1 s y luego `helice:0`. Umbral y duración en `config.ts`.
     Un interruptor "Volar saltando" en el menú (activado por defecto) permite apagarlo. Un salto mientras el botón
     está apretado no debe cortar la hélice.
   - Arriba: nombre y color del robot (círculo), estado de conexión (verde/amarillo/rojo), ping en ms (discreto) y botón salir.
   - Multitouch real: avanzar + girar a la vez (cada botón es independiente).
   - Vibración corta al apretar. Botones de al menos 96 dp.
4. **Reconexión automática** con backoff (1 s, 2 s, 4 s… máx 8 s) **solo si se cortó la red** (cierre del socket sin
   `EXT_CLOSED`), reusando el mismo `deviceId` para recuperar el mismo robot dentro de la gracia del servidor (~20 s).
   Después de un `EXT_CLOSED`, o si el servidor rechaza el token (`token_revoked`/inválido), NO se reintenta nunca:
   se borra el token y se pide escanear de nuevo. Mostrar "Reconectando…". Si el servidor dice que el token ya no vale, volver al
   escaneo con un mensaje claro.
5. **Mensajes claros** para: aula llena (10/10), QR vencido o regenerado, expulsado por el docente, simulador
   cerrado o conexión remota apagada, sin internet.
6. **Entrada manual** de respaldo: pegar el enlace del QR (si falla la cámara).
7. **Botón "Desconectar"** en la pantalla de control: manda `{"protocol":"R26","version":1,"type":"EXT_LEAVE"}`,
   cierra el socket y vuelve al inicio. El servidor quita el robot al instante y el token **sigue valiendo**: mientras el
   docente no apague ni regenere, el alumno puede volver a entrar **escaneando otra vez el mismo QR** (si hay lugar; si no,
   "El aula está llena"). Guardá el último nombre usado para sugerirlo de nuevo. Esto NO es lo mismo que un
   `EXT_CLOSED` (ahí se borra el token).
8. Pantalla "Cómo se usa" de 3 pasos y la versión de la app en el pie.

## Un solo QR para instalar o abrir

El QR contiene una URL https con los datos de conexión en el **fragmento** (no en la query):

```
https://vr.lexodive.com/app/#s=<wss-url-urlencoded>&t=<token>
ejemplo: https://vr.lexodive.com/app/#s=wss%3A%2F%2Fvr.lexodive.com%2Fsimengine%2Fws&t=eyJhbGciOi...
```

- **App instalada**: configurá **Android App Links** verificados para `vr.lexodive.com`, path prefix `/app/`
  (`<intent-filter android:autoVerify="true">`, `ACTION_VIEW`, categorías `DEFAULT` y `BROWSABLE`, scheme `https`).
  Al escanear con la cámara del sistema la app se abre sola y se conecta (leer `s` y `t` del fragmento).
- **Esquema propio de respaldo**: registrá también un intent-filter para `vrlexo://join?s=<wss-url-urlencoded>&t=<token>`
  (`ACTION_VIEW`, `DEFAULT`+`BROWSABLE`, scheme `vrlexo`, host `join`). La página web de descarga tiene un botón
  "Abrir en la app" que lo dispara (por si el App Link no abre directo). Mismos parámetros `s` y `t`, misma validación.
- **App no instalada**: esa URL abre una página web (la hace otro equipo) con la descarga del APK.
- Tras instalar, el alumno abre la app y usa **el escáner interno** sobre el mismo QR: debe aceptar exactamente
  la misma URL.
- Entregá el `applicationId` y el **SHA-256 del certificado de firma** para armar `/.well-known/assetlinks.json`.
  `applicationId`: **`vrlexo.control`** (decidido).
- Validación: esquema `https`, host permitido (`vr.lexodive.com`; en debug también `localhost`/IP local), `s` debe
  empezar con `wss://` (`ws://` solo en debug). Rechazar todo lo demás.

## Protocolo WebSocket (IMPLEMENTADO en el servidor — es el contrato final)

**Transporte.** WebSocket de texto a la URL `s` del QR (`wss://vr.lexodive.com/simengine/ws`). Un objeto JSON
por frame. **Todo mensaje, en ambos sentidos, lleva `"protocol":"R26","version":1` y `"type":"..."` al mismo
nivel que el resto de los campos** (no hay sobre ni `payload`). El servidor descarta los frames que no cumplan.
Límites: frame de la app ≤ 4096 bytes; máx. 60 mensajes/seg por conexión (con ráfaga de 30); 1 h sin mensajes
cierra la conexión (el `PING` cada 5 s la mantiene viva).

### Flujo

```
app                                   servidor
 |--- WS connect ---------------------->|
 |--- EXT_HELLO (spawn, deviceId) ----->|   (primer mensaje, obligatorio)
 |<-- EXT_READY (spawned{...}) ---------|   ó  ERROR  y el servidor cierra  (=> mostrar y volver)
 |--- ROBOT_COMMAND / ROBOT_SET ... --->|   (mientras se juega)
 |--- PING ---------------------------->|<-- PONG
 |<-- EXT_STATE (cada 1/hz s) ----------|   (se puede ignorar)
 |--- EXT_LEAVE ----------------------->|   (botón Desconectar) y la app cierra el socket
 |<-- EXT_CLOSED {reason} --------------|   (el servidor te cierra; NO reconectar)
```
El `EXT_HELLO` puede tardar hasta ~6 s en responder (el servidor le pide al simulador que cree el robot):
mostrar "Conectando…" con un timeout de 12 s.

### 1. App → servidor: `EXT_HELLO` (primer mensaje)
```json
{"protocol":"R26","version":1,"type":"EXT_HELLO",
 "token":"<t del QR>","hz":2,"watchdogMs":300,
 "deviceId":"b7f0c2e4-0000-4000-8000-000000000000","spawn":{"name":"Ana"}}
```
| campo | tipo | detalle |
|---|---|---|
| `token` | string | el `t` del QR, tal cual |
| `hz` | número | frecuencia de `EXT_STATE`, 1..30. Usar **2** (la app no necesita sensores) |
| `watchdogMs` | número | 100..10000. Usar **300**: sin comandos en ese tiempo el servidor frena el robot |
| `deviceId` | string ≤ 64 | UUID generado una vez y guardado en el celular. Sirve para recuperar el mismo robot tras un corte de red |
| `spawn` | objeto | **obligatorio para la app**: pide que el servidor le dé SU robot. `{}` o `{"name":"Ana"}` |
| `spawn.name` | string | opcional; omitirlo si el campo está vacío. El servidor limpia (letras, números, espacio y `. _ - '`), recorta a 20, filtra palabras prohibidas y evita repetidos ("Ana 2") |

No mandar `robots` junto con `spawn` (es error).

### 2. Servidor → app: `EXT_READY`
```json
{"protocol":"R26","version":1,"type":"EXT_READY",
 "roomId":"sala-1","robotId":"robot-01","principalId":"robot-01","robotIds":["robot-01","robot-02"],
 "hz":2,"maxMsgPerSec":60,"idleTimeoutSec":3600,"watchdogMs":300,
 "maxPads":10,
 "spawned":{"id":"robot-02","name":"Ana","color":"#1c7ed6","slot":2,"adopted":false,"nameRejected":false}}
```
Lo que importa es `spawned`:
- `id`: id del robot de ESTE celular. **Usarlo como `robotId` en todos los comandos.**
- `name`, `color` (`#rrggbb`): mostrarlos en la pantalla de control.
- `slot`: número de robot (1 = principal; hasta `maxPads` = 10).
- `adopted`: `true` si le tocó el robot principal del simulador (conserva el nombre que ya tenía; `name` es ese).
- `nameRejected`: `true` si el nombre pedido no pasó el filtro y se asignó uno por defecto → avisar
  "Ese nombre no está permitido, se usó <name>". La app **no** filtra nombres.

El resto de los campos (`roomId`, `robotIds`, …) se pueden ignorar.

### 3. App → servidor: mover (`ROBOT_COMMAND`)
```json
{"protocol":"R26","version":1,"type":"ROBOT_COMMAND","robotId":"robot-02","traction":70,"steering":0}
```
- `traction` −100..100 (+ adelante, − atrás). `steering` −100..100 (**+ gira a la derecha**, − a la izquierda).
  Los valores fuera de rango se recortan; deben ser números finitos (nada de `NaN` ni strings).
- Adelante `traction=70`; atrás `traction=-70`; derecha `steering=70`; izquierda `steering=-70`. Dos botones se
  suman (adelante+derecha = `traction 70, steering 70`; adelante+atrás = 0). `SPEED = 70` en `config.ts`.
- **Mientras haya algún botón apretado: reenviar cada 50 ms** (el watchdog de 300 ms frena el robot si no llega
  nada). **Al soltar todo: enviar UN comando con `traction:0, steering:0`.** Con ningún botón apretado no enviar
  comandos (solo el `PING`).
- `robotId` distinto del propio → el servidor responde `ERROR` (`robotId no permitido o desconocido`).

### 4. App → servidor: volar (`ROBOT_SET`)
```json
{"protocol":"R26","version":1,"type":"ROBOT_SET","robotId":"robot-02","helice":100}
```
`helice` 0..100. Botón apretado (o salto detectado) → `helice:100`; al soltar / terminar el pulso → `helice:0`.
`ROBOT_SET` también acepta `led`, `buzzer`, `kicker`, `sword` (booleanos): **la app no los usa**.

### 5. Latido
`{"protocol":"R26","version":1,"type":"PING"}` → el servidor responde `{"protocol":"R26","version":1,"type":"PONG"}`.
Enviar cada 5 s y medir el RTT para mostrar el ping.

### 6. Desconectar (botón de la app)
`{"protocol":"R26","version":1,"type":"EXT_LEAVE"}` y cerrar el socket. El servidor quita el robot **de inmediato**
(libera el lugar) y el token **sigue valiendo**: mientras el docente no apague el modo ni regenere el QR, el alumno
puede volver a entrar escaneando otra vez el mismo QR (si hay lugar).

### 7. Servidor → app: lo que puede llegar
- `ERROR` `{"type":"ERROR","message":"..."}` (con `protocol`/`version` como todos):
  - **Antes de `EXT_READY`** (respuesta a `EXT_HELLO`; el servidor cierra el socket después): es fatal.
    Mensajes reales y qué mostrar:
    - empieza con `token_revoked:` → "Este QR ya no es válido. Pedile al docente que lo muestre de nuevo y escanealo otra vez." **Borrar el token guardado.**
    - mensaje que empieza con `EXT_HELLO:` (token inválido, vencido o mal firmado) → "El QR venció o no es válido. Escaneá uno nuevo." Borrar el token.
    - empieza con `EXT_HELLO.spawn:` y contiene `llena` → "El aula está llena (10/10 robots). Probá en un rato." **No** borrar el token.
    - contiene `modo celulares no está activado` o `conexión remota no está activada` → "El docente todavía no activó el modo celulares." No borrar el token.
    - contiene `no está publicando datos` o `no pudo crear el robot` → "El simulador no responde. Avisale al docente." No borrar el token.
    - contiene `demasiadas conexiones externas` → tratarlo como aula llena.
    - cualquier otro → mostrar el texto tal cual.
  - **Después de `EXT_READY`**: no es fatal (ej. `demasiados mensajes por segundo`, `robotId no permitido…`): toast corto.
- `EXT_CLOSED` `{"type":"EXT_CLOSED","reason":"..."}`: el servidor te cierra. Mostrar `reason` y **no reconectar**.
  Razones reales: `el docente apagó el modo celulares`, `el docente regeneró el QR`, `el docente te sacó de la clase`,
  `el alumno cerró el simulador`, `el alumno desactivó la conexión remota`,
  `reemplazada por una conexión nueva del mismo celular` (otra instancia de la app con el mismo `deviceId`),
  `sin actividad por 1h0m0s`, `exceso sostenido de mensajes`.
  **Regla simple: borrar el token guardado salvo que `reason` contenga `te sacó`** (esa expulsión no invalida el QR:
  el alumno puede escanearlo de nuevo).
- `EXT_STATE` (cada `1/hz` s): estado de sensores del robot; **ignorarlo**.
- Cualquier otro `type`: ignorar en silencio.
- **Cierre del socket SIN `EXT_CLOSED`** (se cayó la red/el wifi): reconectar con backoff 1 s, 2 s, 4 s … máx. 8 s, con el
  mismo `token`, el mismo `deviceId` y el mismo `spawn.name`. El servidor conserva el robot **20 s**; si volvés a tiempo
  recibís el MISMO `spawned.id`; si pasaron los 20 s te da un robot nuevo. Si el reintento da `token_revoked` o `EXT_CLOSED`,
  se acabó: volver al inicio.

### 8. Resumen de tipos
| `type` | sentido | uso en la app |
|---|---|---|
| `EXT_HELLO` | app → servidor | conectar y pedir robot propio |
| `EXT_READY` | servidor → app | conexión aceptada, trae `spawned` |
| `ROBOT_COMMAND` | app → servidor | mover (cada 50 ms mientras hay botón) |
| `ROBOT_SET` | app → servidor | volar (`helice`) |
| `PING` / `PONG` | ambos | latido y RTT |
| `EXT_LEAVE` | app → servidor | botón Desconectar |
| `EXT_CLOSED` | servidor → app | el servidor te cierra |
| `ERROR` | servidor → app | aviso o fallo |
| `EXT_STATE` | servidor → app | ignorar |

## Requisitos técnicos

- **Expo (SDK actual) + TypeScript**, build con **EAS Build** → APK instalable (`buildType: apk`) y AAB.
  Android mínimo API 24. Solo Android.
- Librerías sugeridas: `expo-camera` (QR), `expo-linking` (recibir el App Link), `expo-keep-awake`,
  `expo-screen-orientation`, `expo-haptics`, `expo-sensors` (acelerómetro para el salto), `@react-native-async-storage/async-storage`, `expo-crypto`/`uuid`
  para el `deviceId`. WebSocket nativo de RN (sin socket.io).
- Estructura: `src/net/ExtClient.ts` (conexión, reconexión, envío a 20 Hz, estado observable),
  `src/qr/parseJoinUrl.ts` (con tests), `src/screens/{Home,Scan,Control,Help}.tsx`, `src/i18n/`, `src/theme`.
- El envío **no debe depender de re-renders**: el estado de los 5 botones en un `ref` y un `setInterval` de 50 ms
  dentro de `ExtClient` que manda si hay algún botón activo.
- `AppState`: al pasar a segundo plano, soltar todo, mandar comando en cero y cerrar el socket limpio; al volver,
  reconectar con el mismo `deviceId`.
- Accesibilidad: contraste alto, etiquetas en los botones, no depender solo del color.
- Sin analíticas ni trackers. Permisos mínimos: `CAMERA`, `INTERNET`, `VIBRATE`.
- Tema oscuro, botones redondeados grandes, el color del robot como acento tras `EXT_READY`.

## Pruebas y entregables

1. Código completo y `README.md`: correr en desarrollo, generar el APK, cambiar el host permitido, y el contrato
   del protocolo (copiá la sección de arriba).
2. Tests unitarios de `parseJoinUrl` (URL válida, host no permitido, falta `t`, `ws://` en release) y de
   `ExtClient` con un WebSocket falso (HELLO → READY → comandos a 20 Hz → cero al soltar → reconexión con backoff →
   `EXT_CLOSED` no reconecta).
3. **Servidor falso** de desarrollo (script Node con `ws`) que implemente el contrato: acepta `EXT_HELLO`, responde
   `EXT_READY` con `spawned` ("Robot N" si no hay nombre), imprime los comandos recibidos y permite simular
   `EXT_CLOSED`, aula llena y corte de red. Así se prueba sin el backend real.
4. Configuración en un solo archivo (`src/config.ts`): hosts permitidos, `SPEED`, intervalo de envío, backoff,
   `applicationId`, URL de descarga del APK.
5. `applicationId` y SHA-256 de la firma de release para el `assetlinks.json`.

## Fuera de alcance

Login/cuentas, ver cámara o sensores del robot, escenarios, chat, iOS, publicar en Play Store, notificaciones push.

## Criterios de aceptación

- Escanear el QR con la cámara nativa abre la app y deja al alumno en la pantalla de control en menos de 5 s.
- Con el nombre vacío, el robot aparece con el nombre que asigne el servidor.
- Apretar adelante + girar a la vez funciona; soltar frena en menos de 400 ms.
- Cortar el wifi 5 s y volver: reconecta y conserva el mismo robot.
- 10 teléfonos (o 10 clientes simulados) a la vez no se pisan.
