# Huella SHA-256 del certificado de firma

Paquete: `com.lexodive.vrcontroller`
Certificado: `CN=VR Lexo Control, O=VR Lexo`

Para el campo "Añadir clave" (con dos puntos):

```
CD:11:40:96:BB:68:4C:83:5C:E8:A8:76:15:57:7C:D6:19:41:68:13:C8:79:67:BD:BF:CE:DA:A3:29:32:1F:3F
```

Sin dos puntos (formato apksigner):

```
cd114096bb684c835ce8a87615577cd619416813c87967bdbfcedaa329321f3f
```

Verificada con `apksigner verify --print-certs dist/vrlexo-control.apk` (coincide con `docs/ENTREGA.md`).

Es la clave con la que firmamos el APK/AAB. Si Play App Signing firma con otra clave, esa huella
se ve en Play Console → Integridad de la app → Firma de apps.
