# VR Lexo Control

App Android (React Native + Expo + TypeScript) para teleoperar un robot de VR Lexo desde el celular
(adelante, atrás, girar, volar). Se conecta escaneando el QR del simulador. `applicationId`: `vrlexo.control`.

El encargo completo y el contrato del protocolo están en `docs/PROMPT.md` (y copiados más abajo).
El servidor y el panel con el QR viven en el repo `vrLexo` (modo "Control desde celulares").

## Estructura

```
App.tsx                      navegación (Inicio / Escanear / Control / Ayuda) y App Links
src/config.ts                TODA la configuración: hosts, SPEED, intervalos, backoff, sacudida, inclinación, descarga del APK
src/net/ExtClient.ts         conexión WebSocket, reconexión, envío cada 50 ms, estado observable (sin React)
src/qr/parseJoinUrl.ts       validación del QR / App Link / vrlexo://join
src/sensors/FlightController.ts  hélice proporcional al movimiento vertical del celular
src/sensors/TiltController.ts    manejar inclinando el celular (volante + inclinación)
src/screens/{Home,Scan,Control,Help}.tsx
src/i18n/                    es (base), en, pt
src/theme/                   colores y tamaños
tools/servidor_falso.js      servidor falso del protocolo para probar sin el backend real
referencia/celulares_falsos.py   cliente Python de referencia
docs/                        PROMPT.md (encargo), PREGUNTAS.md, ENTREGA.md
```

## Correr en desarrollo

Requisitos: Node 20+ y un celular Android o emulador. Lo más seguro para probar en un celular real es un
*development build* (`eas build -p android --profile development`); Expo Go puede alcanzar para una prueba rápida
(no se verificó el App Link ni la cámara en Expo Go).

```bash
npm install
npm start            # Expo; abrir con Expo Go o
npm test             # jest: parseJoinUrl, ExtClient (WebSocket falso), sensores
npm run typecheck
```

### Probar sin el backend real

```bash
npm run servidor-falso          # puerto 8787 (o: node tools/servidor_falso.js 9000)
```

Imprime los enlaces de prueba (con la IP de tu PC y `10.0.2.2` para el emulador). Pegalos en "Pegar el enlace del QR"
dentro de la app. En modo debug (`__DEV__`) el validador acepta `localhost`/IP local y `ws://`; en release, no.
En la consola del servidor podés escribir `cerrar`, `expulsar`, `regenerar`, `llena`, `modo-off`, `revocar`,
`corte` (corte de red sin `EXT_CLOSED`), `bajar [seg]`, `lista`, `ayuda`.
El token de prueba es `token-de-prueba`. Para la carga de 10 celulares se puede apuntar `referencia/celulares_falsos.py`
al mismo enlace (con `ws://` directo: `python celulares_falsos.py "ws://IP:8787#token-de-prueba"`).

## Cambiar el host permitido

En `src/config.ts`: `HOSTS_PERMITIDOS` (validación del QR) y `PATH_APP`. Además hay que cambiar el mismo host en
`app.json` → `android.intentFilters[0].data[0].host` (App Link) y regenerar el build nativo
(`eas build`), y publicar el `assetlinks.json` en ese host. `URL_DESCARGA_APK` también está en `config.ts`.

## Generar el APK

```bash
npm i -g eas-cli
eas login
eas build -p android --profile production        # APK firmado (buildType: apk)
eas build -p android --profile production-aab    # AAB
```

La primera vez EAS ofrece crear el keystore: aceptar. `appVersionSource` es `local`: subir `version` y
`android.versionCode` en `app.json` en cada release.

## Compilar el APK en la PC (alternativa a EAS, Windows)

`eas build --local` no anda en Windows. Se puede compilar con Gradle si hay Android SDK (Android Studio) y **JDK 17**
(con el JDK 25 que trae Android Studio falla el paso de CMake):

```powershell
npx expo prebuild -p android --no-install          # genera android/ (está en .gitignore)
$env:JAVA_HOME = "<ruta al JDK 17>"; $env:ANDROID_HOME = "<ruta al SDK>"
# android/local.properties:  sdk.dir=<ruta al SDK, con \\ y \: escapados>
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
# el APK sale firmado con la clave de depuración: volver a firmarlo con el keystore propio
apksigner sign --ks <vrlexo-control.jks> --ks-key-alias vrlexo --ks-pass env:KS_PW --key-pass env:KS_PW app-release.apk
apksigner verify --print-certs app-release.apk     # el SHA-256 del certificado va en assetlinks.json
```

Los datos de la última entrega (hashes, huella, keystore) están en `docs/ENTREGA.md`.

cm## Actualizaciones de la app

Android no deja que una app instalada fuera de Play Store se reemplace sola: siempre hay que tocar "Instalar". Lo que hace la
app es **avisar**:

- Al abrirse y al entrar al escáner consulta `https://vr.lexodive.com/app/version.json` (`URL_VERSION` en `src/config.ts`).
- Si el `versionCode` publicado es mayor que el instalado: en **Inicio** aparece un cartel "Versión nueva disponible" y,
  **al escanear el QR**, un aviso con "Actualizar" (abre el APK en el navegador para descargarlo e instalarlo) y
  "Continuar igual" (conecta sin actualizar; no vuelve a preguntar hasta reiniciar la app).
- Si no hay internet, el servidor tarda más de 5 s o el archivo es raro, no pasa nada y la app sigue normal.
- Solo se ofrecen descargas de un host de `HOSTS_PERMITIDOS` y por `https`.

`version.json` (lo escribe `tools/publicar_version.js`):

```json
{ "versionCode": 2, "versionName": "1.1.0", "url": "https://vr.lexodive.com/app/vrlexo-control.apk", "sha256": "…" }
```

### Publicar una versión nueva
1. Subir `version` y `android.versionCode` en `app.json` (el `versionCode` **tiene que ser mayor** que el anterior).
2. Compilar y firmar el APK (ver "Compilar el APK en la PC"); queda en `dist/vrlexo-control.apk`.
3. `npm run publicar-version` copia el APK y su `.sha256` y escribe `version.json` en `../vrLexo/public/app`
   (o `node tools/publicar_version.js <carpeta>`). Se niega a publicar una versión menor que la ya publicada.
4. Commit + push en el repo del simulador y `bash deploy.sh` en vm5.

## Notas de implementación

- **Multitouch**: las áreas de los 5 botones se calculan por geometría y se detectan con los eventos táctiles crudos
  de un único contenedor (el sistema de "responder" de React Native solo deja un `Pressable` activo a la vez).
- El envío no depende de re-renders: el estado de los botones vive en `ExtClient` y un `setInterval` de 50 ms reenvía.
- Segundo plano (`AppState`): se suelta todo, se manda cero y se cierra el socket (sin `EXT_LEAVE`, para conservar el
  robot durante la gracia de 20 s); al volver se reconecta con el mismo `deviceId`.
- Sin analíticas ni trackers. Permisos: `CAMERA`, `INTERNET`, `VIBRATE`, `HIGH_SAMPLING_RATE_SENSORS` (sin él, Android 12+ entrega el acelerómetro a ~5 Hz y la bolita va lenta; es de nivel normal, no pide nada al usuario) (el resto se bloquea en `app.json`).

ag## Protocolo (contrato final del servidor)


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
`helice` 0..100. Botón apretado → `helice:100`; al soltar → `helice:0`. **Extensión de la app:** al mover el celular rápido arriba/abajo manda un valor proporcional (5..100, a lo sumo cada 100 ms) y baja a 0 al parar; si el botón también está apretado manda el mayor.
`ROBOT_SET` también acepta `led`, `buzzer`, `kicker`, `sword` (booleanos). **La app usa `led`, `sword` y `buzzer`** (un campo por mensaje, solo al cambiar): el botón LED y el de la espada alternan `true`/`false`; el del buzzer manda `buzzer:true` y 1 s después (`BUZZER_MS` en `src/config.ts`) `buzzer:false`. `kicker` no se usa. Tras reconectar se vuelve a mandar el LED y la espada si estaban activos.

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
| `ROBOT_SET` | app → servidor | volar (`helice`), LED, espada láser y buzzer |
| `PING` / `PONG` | ambos | latido y RTT |
| `EXT_LEAVE` | app → servidor | botón Desconectar |
| `EXT_CLOSED` | servidor → app | el servidor te cierra |
| `ERROR` | servidor → app | aviso o fallo |
| `EXT_STATE` | servidor → app | ignorar |

## Cuando la app esté lista (entrega)

1. Generar el APK de release firmado (`eas build -p android --profile production`, `buildType: apk`).
2. Calcular su hash: `sha256sum vrlexo-control.apk > vrlexo-control.apk.sha256` (en Windows: `certutil -hashfile vrlexo-control.apk SHA256`).
3. Copiar **los dos archivos** al repo del simulador, en `D:\github\vrLexo\public\app\`:
   - `vrlexo-control.apk`
   - `vrlexo-control.apk.sha256`
   (el botón "Descargar la app" de `https://vr.lexodive.com/app/` apunta a ese nombre exacto).
4. Sacar el **SHA-256 del certificado de firma** (no del APK): `keytool -list -v -keystore <tu.keystore>` → línea
   `SHA256:` (o en EAS: `eas credentials`). Pegarlo en `D:\github\vrLexo\public\.well-known\assetlinks.json`
   en lugar de `REEMPLAZAR:SHA256_DEL_CERTIFICADO_DE_FIRMA_DE_LA_APP` (formato `AA:BB:CC:...`).
   Sin esto, el QR no abre la app directo (igual funciona el botón "Abrir en la app").
5. En `D:\github\vrLexo`: commit + push, y en vm5 `bash deploy.sh`. Verificar que
   `https://vr.lexodive.com/.well-known/assetlinks.json` responde JSON sin redirección.
6. Guardar el keystore y sus claves en un lugar seguro FUERA de git: si se pierde no se puede actualizar la app.
