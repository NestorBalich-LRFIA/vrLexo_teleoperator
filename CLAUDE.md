# VR Lexo Control (vrLexo_teleoperator)

App Android (React Native + Expo + TypeScript) para manejar un robot del simulador VR Lexo
desde el celular, escaneando un QR.

**Tu encargo completo está en `docs/PROMPT.md`: leelo entero antes de escribir código** (requisitos,
protocolo WebSocket con todos los paquetes, validación del QR, App Links, pruebas y entregables).

- El servidor ya está hecho (repo hermano `D:\github\vrLexo`, no lo modifiques desde acá). Si necesitás
  algo que el protocolo no cubre, anotalo en `docs/PREGUNTAS.md` en vez de inventarlo.
- `referencia/celulares_falsos.py` es un cliente Python que habla el protocolo real: sirve para ver el
  intercambio de paquetes y como guía para el servidor falso de pruebas que hay que entregar.
- `applicationId`: `vrlexo.control`. Hosts permitidos del QR: `vr.lexodive.com` (y `localhost`/IP local en debug).
- Todo texto de la app en español (i18n preparado para en/pt). Código y comentarios en español, como el repo hermano.
