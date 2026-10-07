# Preguntas abiertas / cosas que el protocolo no cubre

Nada bloqueante. Decisiones tomadas y puntos para confirmar con el equipo del servidor:

1. **Primera conexión que falla (sin red / servidor caído)**: el encargo dice reconectar solo si "se cortó la red"
   (socket cerrado sin `EXT_CLOSED`). Interpretación: se reintenta únicamente si ya hubo un `EXT_READY` en esta sesión;
   si la primera conexión no llega a `EXT_READY` se muestra "Sin conexión" con botón "Reintentar" (no se borra el token).
   Si el equipo prefiere reintentar también la primera vez, es un cambio de una línea en `ExtClient.alCaer`.
2. **Timeout de 12 s sin `EXT_READY`**: se trata igual que el punto 1 (cierra y avisa "El servidor no respondió").
3. **Botón atrás de la app / minimizar**: al pasar a segundo plano se cierra el socket **sin** `EXT_LEAVE` para que el
   robot siga durante la gracia de 20 s. Si pasan más de 20 s, al volver se recibe un robot nuevo.
4. **Token guardado**: se guarda el último QR válido en el celular para ofrecer "Volver a entrar" en Inicio; se borra
   según las reglas del encargo (`token_revoked`, `EXT_HELLO:`, `EXT_CLOSED` salvo "te sacó").
5. **Volar moviendo el celular** (cambio pedido después del encargo): en vez del pulso fijo de 1 s tras un salto, la hélice es
   proporcional a la aceleración vertical (más rápido = más alto) y baja sola. Los valores del protocolo siguen en 0..100,
   pero se mandan más `ROBOT_SET` (hasta 10/s). Umbrales en `SACUDIDA`, `src/config.ts`, a calibrar con celulares reales.
6. **App Link verificado**: necesita el SHA-256 del certificado de firma en `assetlinks.json` (ver `docs/ENTREGA.md`).

## Canal Bluetooth (robot físico) — contrato provisorio

Lo implementa `src/net/BleSocket.ts` (UUIDs y MTU en `BLE`, `src/config.ts`). El firmware real todavía no existe: confirmar con quien lo haga.

7. **Transporte**: BLE con servicio tipo Nordic UART (RX = app→robot, escritura sin respuesta; TX = robot→app, notificaciones).
8. **Formato**: el mismo JSON de los paquetes del servidor (`ROBOT_COMMAND`, `ROBOT_SET`), una línea por paquete terminada en `\n`,
   troceada según el MTU (se piden 247). El firmware junta hasta el `\n`.
9. **Handshake**: lo resuelve la app. `EXT_HELLO` → `EXT_READY` local (`robotId` = id del dispositivo), `PING` → `PONG` local, `EXT_LEAVE` no se envía.
   El `robotId` llega igual en cada paquete; el firmware puede ignorarlo.
10. **Seguridad**: el firmware debe parar los motores si pasan ~300 ms sin `ROBOT_COMMAND` (la app reenvía cada 50 ms mientras haya dirección).
11. **Sin confirmar**: si el robot soporta `helice`, `led`, `sword`, `buzzer` (hoy la app los manda igual); si publica los robots con el UUID de servicio (el escaneo filtra por él).
