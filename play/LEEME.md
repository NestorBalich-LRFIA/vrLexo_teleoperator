# Todo para Google Play — LexoDive VR Controller

Paquete `com.lexodive.vrcontroller`. Esta carpeta junta lo que se carga en Play Console. Se regenera con `python tools/generar_play.py <carpeta con capturas>`.

## Contenido
| Qué | Dónde | Dónde se carga en Play Console |
|---|---|---|
| Ícono de la ficha (512×512) | `icono-512.png` | Presencia en Play Store → Ficha principal → Ícono de la app |
| Gráfico de funciones (1024×500) | `grafico-funciones.png` | Ficha principal → Gráfico de funciones |
| Capturas de teléfono (4, 1080×2160) | `capturas/01…04_*.png` | Ficha principal → Capturas de teléfono (mín. 2, máx. 8) |
| Textos (nombre, breve, completa) | `textos/es-419.md`, `en-US.md`, `pt-BR.md` | Ficha principal (idioma predeterminado es-419) y traducciones |
| Seguridad de los datos, permisos, acceso, clasificación | `declaraciones.md` | Contenido de la app |
| Logo para la app (ícono adaptable, splash) | `app/` | **No es para Play**: reemplaza a `assets/` si te gusta el logo |

## Lo que falta antes de publicar
1. **Bundle (.aab) nuevo.** `dist/LexoDive-VR-Controller-1.1.3.aab` es anterior a los cambios de esta rama (Bluetooth, entrada directa, nombre tras el QR). Hay que subir `version`/`versionCode` (hoy 1.1.3 / 5) y generar y firmar el AAB con la clave de subida (`D:\keystore-vrlexo-control\v2\`), siguiendo `docs/ENTREGA.md`. Pendiente de que lo pidas.
2. **URL de la política de privacidad** pública (ver `declaraciones.md`).
3. **QR/enlace de prueba o video** para el revisor (ver "Acceso a la app").
4. Decidir el **público objetivo** (menores de 13 años → política de familias).
5. Tras la primera subida: agregar la huella de la "firma de apps de Play" al `assetlinks.json` (Integridad de la app), según `docs/ENTREGA.md`.
6. Si querés **capturas de tablet** (7" y 10") o de otro tamaño, hay que generarlas aparte; no son obligatorias para teléfono.

## Notas de las imágenes
- El logo es nuevo (robot con visor VR); hasta ahora la app usaba el ícono de plantilla de Expo. Si lo aprobás hay que aplicarlo también a `assets/` y reconstruir, para que la ficha y la app coincidan.
- Las capturas salen de un emulador con barra de estado limpia; el robot se llama "Robot 1" porque lo asigna el servidor de pruebas.
- Las capturas no muestran la búsqueda Bluetooth con robots ni el escáner QR (el emulador no tiene robots ni cámara real).
