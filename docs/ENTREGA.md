# Entrega

APK de release firmado, generado en la PC (build local con Gradle) el 2026-10-06.

| dato | valor |
|---|---|
| `applicationId` | `com.lexodive.vrcontroller` (nombre: LexoDive VR Controller) |
| Versión (`version` / `versionCode`) | `1.1.3` / `5` |
| Arquitecturas incluidas | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| Android mínimo | API 24 |
| SHA-256 del certificado de firma | `CD:11:40:96:BB:68:4C:83:5C:E8:A8:76:15:57:7C:D6:19:41:68:13:C8:79:67:BD:BF:CE:DA:A3:29:32:1F:3F` |
| SHA-256 del APK (`vrlexo-control.apk`) | `c6f291c4652f95ce7ec5f8069891e86127538281cad6394546ba0b0846ab89ad` |
| Tamaño del APK | 72013435 bytes (≈ 69 MB, ver `dist/`) |
| Permisos |  `CAMERA`, `INTERNET`, `VIBRATE` y `ACCESS_NETWORK_STATE` (este último lo agrega React Native; es de nivel normal y no pide permiso al usuario) |
| Idioma | Español fijo (`IDIOMA_FORZADO` en `src/config.ts`; en/pt disponibles) |
| Esquemas de firma | APK Signature Scheme v2 y v3 (verificado con `apksigner verify`) |

El certificado es `CN=VR Lexo Control, O=VR Lexo`, RSA 2048, válido hasta 2054-02-21.

## Actualizaciones

La app consulta `https://vr.lexodive.com/app/version.json` y avisa si hay una versión nueva (ver "Actualizaciones de la app" en
`README.md`). `npm run publicar-version` copia el APK y escribe ese archivo; el `versionCode` de `app.json` hay que subirlo en cada release.
El `version.json` publicado ahora dice `versionCode 3` / `1.1.1`.

## Qué se hizo con los archivos

- `vrlexo-control.apk` y `vrlexo-control.apk.sha256` están copiados en `D:\github\vrLexo\public\app\`
  (el botón "Descargar la app" de `https://vr.lexodive.com/app/` apunta a ese nombre).
- La huella del certificado está puesta en `D:\github\vrLexo\public\.well-known\assetlinks.json`
  (`package_name`: `vrlexo.control`).

## Falta (lo hace una persona)

1. En `D:\github\vrLexo`: commit + push (hay 3 cambios sin commitear: el APK, su `.sha256` y `assetlinks.json`).
2. En vm5: `bash deploy.sh`.
3. Verificar que `https://vr.lexodive.com/.well-known/assetlinks.json` responde JSON, con la huella de arriba y **sin redirección**.
4. Probar en un celular: instalar el APK desde `https://vr.lexodive.com/app/`, y escanear el QR del simulador con la cámara
   del sistema: debería abrir la app directo. (Android verifica el App Link al instalar: si se instaló antes de publicar el
   `assetlinks.json`, desinstalar y reinstalar, o ejecutar `adb shell pm verify-app-links --re-verify vrlexo.control`.)

## Keystore (importante)

La firma del APK está en `D:\keystore-vrlexo-control\` (`vrlexo-control.jks` y `LEEME-PASSWORD.txt` con el alias `vrlexo` y la
contraseña). **Está fuera de git a propósito.** Hay que guardar una copia en otro lugar (pendrive, nube privada): si se
pierde el archivo o la contraseña no se puede actualizar la app ya instalada; habría que desinstalarla y publicar una nueva
con otra firma (y actualizar el `assetlinks.json`).

## Cómo se generó (build local, Windows)

`eas build --local` no funciona en Windows, y el build en la nube de EAS tenía una cola de más de una hora, así que se compiló
en la PC (ver "Compilar el APK en la PC" en `README.md`). Notas de esta corrida:

- Con el JDK 25 que trae Android Studio, el paso de CMake falla (`A restricted method in java.lang.System has been called`).
  Se usó un **JDK 17** (Temurin) portátil como `JAVA_HOME`.
- `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64` generó un APK firmado con la clave de
  depuración de la plantilla; se volvió a firmar con `apksigner` y el keystore de arriba.
- En EAS quedó creado el proyecto `@nbalich/vrlexo-control` (su `projectId` está en `app.json`) con un keystore propio de EAS
  que **no se usó**: el build de la nube se canceló. Se puede borrar desde expo.dev si se quiere.

## 1.1.1 (2026-10-07)

- Arregla la bolita lenta del APK: se agregó `HIGH_SAMPLING_RATE_SENSORS` (sin él, Android 12+ entrega el acelerómetro a ~5 Hz).
- **Keystore nuevo** (`v2\`): se había perdido la contraseña del anterior. Como todavía no hay usuarios, se cambió la firma:
  quien tenga la 1.0/1.1.0 instalada debe **desinstalarla** antes de instalar la 1.1.1. El `assetlinks.json` ya tiene la huella nueva.
- Al subir a Google Play: la clave de este keystore pasa a ser la de subida; hay que agregar al `assetlinks.json` la huella de la
  "firma de apps de Play" (Play Console → Integridad de la app).
- Después del deploy hay que purgar la caché de Cloudflare de `/app/vrlexo-control.apk` y `/app/version.json` (cachea 4 h).

## 1.1.2 (2026-10-07): nombre y paquete definitivos, para Google Play

- App **LexoDive VR Controller**, `applicationId` `com.lexodive.vrcontroller` (antes `vrlexo.control`; Android la trata como app distinta).
- Primera pantalla: descripción con el enlace a vr.lexodive.com; los interruptores de volar/inclinar se quitaron (la inclinación se activa en el control).
- Para Play se sube un **AAB** firmado con la clave de subida (`D:\keystore-vrlexo-control\v2\`). El AAB de Gradle viene firmado con la clave de
  depuración de la plantilla: hay que borrar `META-INF/ANDROIDD.*` y `MANIFEST.MF` antes de firmar con `jarsigner`, si no Play rechaza
  "más de una cadena de certificados". Salida: `dist/LexoDive-VR-Controller-1.1.2.aab` (SHA-256 del certificado `CD:11:40:96:…:1F:3F`).
- Falta: agregar a `assetlinks.json` la huella de la "firma de apps de Play" y publicar un APK con el paquete nuevo en `vr.lexodive.com`
  (el publicado sigue siendo el 1.1.1 con `vrlexo.control`; por eso `assetlinks.json` y `app/index.html` del repo del simulador siguen sin commitear).

## 1.1.3 (2026-10-07)

- Se puede avanzar/girar inclinando y volar sacudiendo al mismo tiempo: mientras se sacude se mantiene la última inclinación válida
  (antes se anulaba y el robot se frenaba). Probado en un celular real.
- AAB para Play: `dist/LexoDive-VR-Controller-1.1.3.aab`, firmado con la clave de subida (`v2`), una sola cadena de certificados.
