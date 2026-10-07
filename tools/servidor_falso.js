#!/usr/bin/env node
/**
 * Servidor falso de desarrollo para VR Lexo Control: implementa el contrato del protocolo R26/EXT_*
 * sin necesitar el backend real. Imprime lo que recibe y permite simular situaciones desde la consola.
 *
 * Uso:   node tools/servidor_falso.js [puerto]        (por defecto 8787)
 *        npm run servidor-falso
 *
 * Comandos (escribilos en la consola y Enter):
 *   cerrar [motivo]   manda EXT_CLOSED a todos y los cierra (la app NO debe reconectar)
 *   expulsar          EXT_CLOSED "el docente te sacó de la clase"
 *   regenerar         EXT_CLOSED "el docente regeneró el QR" y revoca el token actual
 *   llena [on|off]    el aula está llena: EXT_HELLO responde ERROR "…llena…" (sin on/off alterna)
 *   modo-off [on|off] responde "el modo celulares no está activado"
 *   revocar [on|off]  responde ERROR "token_revoked: …"
 *   corte             corta la red: termina los sockets SIN EXT_CLOSED (la app debe reconectar con backoff)
 *   bajar [seg]       rechaza conexiones nuevas durante N seg (default 5) y además corta las actuales
 *   lista             muestra los celulares conectados
 *   ayuda             muestra esta lista
 */
const os = require('os');
const readline = require('readline');
const { WebSocketServer } = require('ws');
const qrcode = require('qrcode-terminal');

const PUERTO = Number(process.argv[2]) || 8787;
const TOKEN = 'token-de-prueba';
const MAX_PADS = 10;
const GRACIA_MS = 20000;
const PROTO = { protocol: 'R26', version: 1 };
const COLORES = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#9c36b5', '#0c8599', '#e64980', '#5c940d', '#7048e8', '#495057'];

const estado = { llena: false, modoOff: false, revocar: false, caidoHasta: 0 };
/** deviceId -> { slot, id, name, color, ws, graciaTimer } */
const celulares = new Map();

const hora = () => new Date().toLocaleTimeString('es-AR');
const log = (...a) => console.log(`[${hora()}]`, ...a);

function enviar(ws, tipo, extra = {}) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ...PROTO, type: tipo, ...extra }));
}

function error(ws, message, cerrar) {
  enviar(ws, 'ERROR', { message });
  if (cerrar) setTimeout(() => ws.close(), 50);
}

function slotLibre() {
  const usados = new Set([...celulares.values()].map((c) => c.slot));
  for (let i = 1; i <= MAX_PADS; i++) if (!usados.has(i)) return i;
  return 0;
}

function limpiarNombre(n) {
  return String(n || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 20);
}

function nombreUnico(base) {
  const usados = new Set([...celulares.values()].map((c) => c.name));
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base} ${i}`)) return `${base} ${i}`;
}

function alHello(ws, msg, ctx) {
  if (estado.revocar) return error(ws, 'token_revoked: el docente regeneró el QR', true);
  if (estado.modoOff) return error(ws, 'EXT_HELLO: el modo celulares no está activado', true);
  if (msg.token !== TOKEN) return error(ws, 'EXT_HELLO: token inválido o vencido', true);
  if (!msg.deviceId || typeof msg.deviceId !== 'string') return error(ws, 'EXT_HELLO: falta deviceId', true);
  if (msg.robots !== undefined && msg.spawn !== undefined) return error(ws, 'EXT_HELLO: no mandes robots junto con spawn', true);
  if (!msg.spawn || typeof msg.spawn !== 'object') return error(ws, 'EXT_HELLO.spawn: falta spawn', true);

  let cel = celulares.get(msg.deviceId);
  if (cel) {
    // Mismo celular: o vuelve dentro de la gracia (mismo robot) o es un duplicado (reemplaza a la anterior).
    clearTimeout(cel.graciaTimer);
    if (cel.ws && cel.ws !== ws && cel.ws.readyState === cel.ws.OPEN) {
      enviar(cel.ws, 'EXT_CLOSED', { reason: 'reemplazada por una conexión nueva del mismo celular' });
      cel.ws.close();
    }
    cel.ws = ws;
    log(`↻ ${cel.name} (${cel.id}) volvió dentro de la gracia: mismo robot`);
  } else {
    const slot = slotLibre();
    if (estado.llena || !slot) return error(ws, 'EXT_HELLO.spawn: el aula está llena (10/10 robots)', true);
    const pedido = limpiarNombre(msg.spawn.name);
    const base = pedido || `Robot ${slot}`;
    cel = {
      slot,
      id: `robot-${String(slot).padStart(2, '0')}`,
      name: nombreUnico(base),
      color: COLORES[(slot - 1) % COLORES.length],
      ws,
      graciaTimer: null,
    };
    celulares.set(msg.deviceId, cel);
    log(`+ ${cel.name} (${cel.id}, slot ${cel.slot})`);
  }
  ctx.deviceId = msg.deviceId;
  ctx.listo = true;
  const spawned = { id: cel.id, name: cel.name, color: cel.color, slot: cel.slot, adopted: cel.slot === 1, nameRejected: false };
  // Con 600 ms de espera simulamos que el simulador tarda en crear el robot.
  setTimeout(
    () =>
      enviar(ws, 'EXT_READY', {
        roomId: 'sala-falsa',
        robotId: cel.id,
        principalId: 'robot-01',
        robotIds: [...celulares.values()].map((c) => c.id),
        hz: msg.hz,
        maxMsgPerSec: 60,
        idleTimeoutSec: 3600,
        watchdogMs: msg.watchdogMs,
        maxPads: MAX_PADS,
        spawned,
      }),
    600,
  );
}

const wss = new WebSocketServer({ port: PUERTO });

wss.on('connection', (ws) => {
  const ctx = { deviceId: null, listo: false, ultimoComando: null, n: 0, desde: Date.now() };
  if (Date.now() < estado.caidoHasta) return ws.terminate();
  log('conexión nueva');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.protocol !== 'R26' || msg.version !== 1 || typeof msg.type !== 'string') return; // el servidor real lo descarta
    if (raw.length > 4096) return;
    if (!ctx.listo && msg.type !== 'EXT_HELLO') return;
    const cel = ctx.deviceId && celulares.get(ctx.deviceId);
    switch (msg.type) {
      case 'EXT_HELLO':
        return alHello(ws, msg, ctx);
      case 'PING':
        return enviar(ws, 'PONG');
      case 'ROBOT_COMMAND': {
        if (msg.robotId !== cel.id) return error(ws, 'robotId no permitido o desconocido');
        const ok = (v) => typeof v === 'number' && Number.isFinite(v);
        if (!ok(msg.traction) || !ok(msg.steering)) return error(ws, 'traction/steering deben ser números');
        ctx.n++;
        const clave = `${msg.traction},${msg.steering}`;
        // Imprime los cambios (no los 20 por segundo), y cuántos se mandaron entre cambios.
        if (clave !== ctx.ultimoComando) {
          log(`${cel.name}: traction=${msg.traction} steering=${msg.steering}  (comandos desde el cambio anterior: ${ctx.n})`);
          ctx.ultimoComando = clave;
          ctx.n = 0;
        }
        return;
      }
      case 'ROBOT_SET':
        if (msg.robotId !== cel.id) return error(ws, 'robotId no permitido o desconocido');
        return log(`${cel.name}: ROBOT_SET`, JSON.stringify(Object.fromEntries(['helice', 'led', 'sword', 'buzzer', 'kicker'].filter((k) => k in msg).map((k) => [k, msg[k]]))));
      case 'EXT_LEAVE':
        log(`- ${cel.name} salió (EXT_LEAVE): robot quitado, el token sigue valiendo`);
        celulares.delete(ctx.deviceId);
        ctx.deviceId = null;
        ctx.listo = false;
        return ws.close();
      default:
        return;
    }
  });

  ws.on('close', () => {
    const cel = ctx.deviceId && celulares.get(ctx.deviceId);
    if (!cel || cel.ws !== ws) return;
    log(`✖ ${cel.name} se desconectó; conservo el robot ${GRACIA_MS / 1000} s`);
    cel.ws = null;
    cel.graciaTimer = setTimeout(() => {
      celulares.delete(ctx.deviceId);
      log(`- ${cel.name}: pasó la gracia, robot quitado`);
    }, GRACIA_MS);
  });
  ws.on('error', () => {});
});

function aTodos(fn) {
  for (const c of celulares.values()) if (c.ws) fn(c.ws, c);
}

function cerrarTodos(reason) {
  aTodos((ws) => {
    enviar(ws, 'EXT_CLOSED', { reason });
    setTimeout(() => ws.close(), 50);
  });
  celulares.clear();
  log(`EXT_CLOSED enviado: "${reason}"`);
}

function alternar(clave, arg) {
  estado[clave] = arg === 'on' ? true : arg === 'off' ? false : !estado[clave];
  log(`${clave} = ${estado[clave]}`);
}

const AYUDA = 'comandos: cerrar [motivo] | expulsar | regenerar | llena [on|off] | modo-off [on|off] | revocar [on|off] | corte | bajar [seg] | lista | ayuda';

readline.createInterface({ input: process.stdin }).on('line', (linea) => {
  const [cmd, ...resto] = linea.trim().split(/\s+/);
  const arg = resto.join(' ');
  switch (cmd) {
    case 'cerrar':
      return cerrarTodos(arg || 'el docente apagó el modo celulares');
    case 'expulsar':
      return cerrarTodos('el docente te sacó de la clase');
    case 'regenerar':
      estado.revocar = true;
      return cerrarTodos('el docente regeneró el QR');
    case 'llena':
      return alternar('llena', arg);
    case 'modo-off':
      return alternar('modoOff', arg);
    case 'revocar':
      return alternar('revocar', arg);
    case 'corte':
      log('corte de red simulado (sin EXT_CLOSED)');
      return aTodos((ws) => ws.terminate());
    case 'bajar': {
      const s = Number(arg) || 5;
      estado.caidoHasta = Date.now() + s * 1000;
      log(`servidor "caído" ${s} s`);
      return aTodos((ws) => ws.terminate());
    }
    case 'lista':
      for (const [dev, c] of celulares) console.log(`  ${c.id}  ${c.name}  slot ${c.slot}  ${c.ws ? 'conectado' : 'en gracia'}  dev=${dev.slice(0, 8)}`);
      return console.log(`  ${celulares.size}/${MAX_PADS}`);
    case 'ayuda':
    case '?':
      return console.log(AYUDA);
    case '':
      return;
    default:
      return console.log(`comando desconocido. ${AYUDA}`);
  }
});

const ips = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);
// IP de la LAN para el QR: la variable IP (IP=192.168.1.5 npm run servidor-falso) o la primera 192.168.x / 10.x
// (las demás suelen ser VPN o adaptadores virtuales).
const ipLan = process.env.IP || ips.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.')) || ips[0] || '10.0.2.2';
const enlace = (host) => `https://${host}/app/#s=${encodeURIComponent(`ws://${host}:${PUERTO}`)}&t=${TOKEN}`;
console.log(`Servidor falso R26 escuchando en el puerto ${PUERTO} (token: ${TOKEN}, ${MAX_PADS} celulares máx.)`);
console.log(`\nEscaneá este QR con la app (IP ${ipLan}). Solo anda con la app en modo desarrollo:\n`);
qrcode.generate(enlace(ipLan), { small: true });
console.log('Enlaces para pegar en la app:');
for (const ip of ips) console.log(`  ${ip.padEnd(16)} ${enlace(ip)}`);
console.log(`  ${'emulador'.padEnd(16)} ${enlace('10.0.2.2')}`);
console.log(`  esquema propio   vrlexo://join?s=${encodeURIComponent(`ws://${ipLan}:${PUERTO}`)}&t=${TOKEN}`);
console.log(AYUDA);
