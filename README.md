# VR Lexo Control

App Android para teleoperar un robot de VR Lexo desde el celular (adelante, atrás, girar, volar).

Estado: **por desarrollar**. Ver `docs/PROMPT.md` (encargo y protocolo) y `CLAUDE.md`.

```
docs/PROMPT.md              encargo completo + contrato del protocolo WebSocket
referencia/celulares_falsos.py   cliente Python de referencia (celulares falsos)
```

El servidor y el panel con el QR viven en el repo `vrLexo` (modo "Control desde celulares").
El APK final se copia a `vrLexo/public/app/vrlexo-control.apk` para que lo descarguen los alumnos.

## Cuando la app esté lista (para no olvidarse)

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
