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
