"""Celulares falsos: prueba de carga y ejemplo del protocolo del modo "Control desde celulares".

Abre N conexiones como si fueran N celulares con la app LexoDive VR Controller: cada una manda
EXT_HELLO con `spawn` (el servidor le da su robot), y después la mueve (avanza y gira) mandando
ROBOT_COMMAND cada 50 ms, igual que la app. Sirve para:
  - probar el servidor sin celulares reales (10 a la vez, la reconexión, el filtro de nombres...);
  - mostrarle a quien programe la app cómo es el intercambio de paquetes.

Uso (con el simulador abierto y el MODO CELULARES activado en Avanzada):
    pip install websockets
    python 07_celulares_falsos.py "<ENLACE DEL QR>"
    python 07_celulares_falsos.py "<ENLACE DEL QR>" --celulares 10 --segundos 30
    python 07_celulares_falsos.py "<ENLACE DEL QR>" --nombres Ana,Beto,puta,""   # prueba el filtro de nombres
    python 07_celulares_falsos.py "<ENLACE DEL QR>" --salir-al-final            # cada uno manda EXT_LEAVE

El ENLACE DEL QR es la URL que muestra el panel ("Copiar enlace"): https://.../app/#s=<wss>&t=<token>.
También se acepta `wss://host/simengine/ws#TOKEN`.
"""
import argparse
import asyncio
import json
import math
import time
import uuid
from urllib.parse import parse_qs, unquote, urlparse

import websockets

PROTO = {"protocol": "R26", "version": 1}


def parse_link(link: str):
    """-> (url_ws, token) a partir del enlace del QR o de wss://host/ws#TOKEN."""
    u = urlparse(link)
    if u.scheme in ("ws", "wss"):
        return link.split("#")[0], unquote(u.fragment)
    q = parse_qs(u.fragment)
    if "s" not in q or "t" not in q:
        raise SystemExit("El enlace no tiene #s=...&t=...")
    return q["s"][0], q["t"][0]


async def phone(idx: int, url: str, token: str, name: str, seconds: float, leave: bool) -> None:
    tag = "celular %d" % (idx + 1)
    device_id = str(uuid.uuid4())
    async with websockets.connect(url, max_size=1 << 20, ping_interval=20) as ws:
        spawn = {"name": name} if name else {}
        await ws.send(json.dumps(dict(PROTO, type="EXT_HELLO", token=token, hz=2, watchdogMs=300,
                                      deviceId=device_id, spawn=spawn)))
        robot_id = None
        t0 = time.monotonic()

        async def reader():
            nonlocal robot_id
            async for raw in ws:
                msg = json.loads(raw)
                kind = msg.get("type")
                if kind == "EXT_READY":
                    sp = msg["spawned"]
                    robot_id = sp["id"]
                    note = "  (nombre rechazado)" if sp.get("nameRejected") else ""
                    print("%s: robot %s '%s' slot %s%s%s" % (
                        tag, sp["id"], sp["name"], sp["slot"], " [principal]" if sp.get("adopted") else "", note))
                elif kind == "ERROR":
                    print("%s: ERROR %s" % (tag, msg.get("message")))
                elif kind == "EXT_CLOSED":
                    print("%s: cerrado por el servidor: %s" % (tag, msg.get("reason")))
                    return

        rtask = asyncio.create_task(reader())
        try:
            while robot_id is None and not rtask.done() and time.monotonic() - t0 < 12:
                await asyncio.sleep(0.05)
            if robot_id is None:
                return
            # Cada 50 ms: avanzar y girar en ondas distintas por celular (como un alumno con los botones).
            while time.monotonic() - t0 < seconds and not rtask.done():
                t = time.monotonic() - t0
                traction = 70 if math.sin(t * 0.8 + idx) > -0.3 else 0
                steering = int(70 * math.sin(t * 1.3 + idx * 0.7))
                await ws.send(json.dumps(dict(PROTO, type="ROBOT_COMMAND", robotId=robot_id,
                                              traction=traction, steering=steering)))
                if int(t) % 5 == 0:  # un "salto": hélice un instante
                    await ws.send(json.dumps(dict(PROTO, type="ROBOT_SET", robotId=robot_id, helice=100)))
                else:
                    await ws.send(json.dumps(dict(PROTO, type="ROBOT_SET", robotId=robot_id, helice=0)))
                await asyncio.sleep(0.05)
            # Soltar todo: un comando en cero.
            await ws.send(json.dumps(dict(PROTO, type="ROBOT_COMMAND", robotId=robot_id, traction=0, steering=0)))
            if leave:
                await ws.send(json.dumps(dict(PROTO, type="EXT_LEAVE")))
        finally:
            rtask.cancel()


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("enlace", help="enlace del QR (o wss://host/simengine/ws#TOKEN)")
    ap.add_argument("--celulares", type=int, default=10, help="cuántos celulares falsos (1..10)")
    ap.add_argument("--segundos", type=float, default=20.0)
    ap.add_argument("--nombres", default="", help="nombres separados por coma (los que falten quedan vacíos)")
    ap.add_argument("--salir-al-final", action="store_true", help="mandar EXT_LEAVE al terminar")
    a = ap.parse_args()
    url, token = parse_link(a.enlace)
    names = a.nombres.split(",") if a.nombres else []
    n = max(1, min(a.celulares, 10))
    await asyncio.gather(*[
        phone(i, url, token, names[i] if i < len(names) else "", a.segundos, a.salir_al_final)
        for i in range(n)
    ])


if __name__ == "__main__":
    asyncio.run(main())
