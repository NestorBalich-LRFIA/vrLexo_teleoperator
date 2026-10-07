# Entrega

APK de release firmado, generado en la PC (build local con Gradle) el 2026-10-06.

| dato | valor |
|---|---|
| `applicationId` | `vrlexo.control` |
| Versión (`version` / `versionCode`) | `1.0.0` / `1` |
| Arquitecturas incluidas | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| Android mínimo | API 24 |
| SHA-256 del certificado de firma | `7E:5F:1B:4A:DE:05:52:B7:08:16:57:C4:EF:C6:6C:EA:BF:97:E8:16:91:86:20:B3:5C:5C:AD:77:EF:F8:39:C5` |
| SHA-256 del APK (`vrlexo-control.apk`) | `58ea53021567329a69634322e2d4431452dd5487aa1e42a4d2445a84cf5078a4` |
| Tamaño del APK | 72097154 bytes (≈ 69 MB) |
| Permisos |  `CAMERA`, `INTERNET`, `VIBRATE` y `ACCESS_NETWORK_STATE` (este último lo agrega React Native; es de nivel normal y no pide permiso al usuario) |
| Idioma | Español fijo (`IDIOMA_FORZADO` en `src/config.ts`; en/pt disponibles) |
| Esquemas de firma | APK Signature Scheme v2 y v3 (verificado con `apksigner verify`) |

El certificado es `CN=VR Lexo Control, O=VR Lexo`, RSA 2048, válido hasta 2054-02-21.

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
