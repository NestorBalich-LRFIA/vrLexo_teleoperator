# Entrega

> **Estado: PENDIENTE de generar el APK firmado.** El código, los tests y el servidor falso están listos, pero el
> APK de release y la firma necesitan la cuenta de Expo/EAS (`eas login`) y el keystore, que no estaban disponibles
> al desarrollar. Completar los campos marcados con `PENDIENTE` después de correr el build.

| dato | valor |
|---|---|
| `applicationId` | `vrlexo.control` |
| Versión (`version` / `versionCode`) | `1.0.0` / `1` |
| SHA-256 del certificado de firma | PENDIENTE (`eas credentials` → Android → Keystore, o `keytool -list -v -keystore <tu.keystore>`) |
| SHA-256 del APK (`vrlexo-control.apk`) | PENDIENTE (`certutil -hashfile vrlexo-control.apk SHA256`) |

## Pasos (de `README.md`)

1. `eas login` y `eas build -p android --profile production` → descargar el APK, renombrarlo `vrlexo-control.apk`.
2. Hash del APK → `vrlexo-control.apk.sha256`.
3. Copiar ambos a `D:\github\vrLexo\public\app\`.
4. Pegar el SHA-256 del **certificado** (formato `AA:BB:CC:…`) en `D:\github\vrLexo\public\.well-known\assetlinks.json`
   reemplazando `REEMPLAZAR:SHA256_DEL_CERTIFICADO_DE_FIRMA_DE_LA_APP`, con `package_name` = `vrlexo.control`.
5. Commit + push en `D:\github\vrLexo` y `bash deploy.sh` en vm5; verificar que
   `https://vr.lexodive.com/.well-known/assetlinks.json` responde JSON sin redirección.
6. Guardar el keystore y sus claves fuera de git (si se pierde no se puede actualizar la app).
