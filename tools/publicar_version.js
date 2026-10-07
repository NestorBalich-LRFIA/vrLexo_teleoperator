#!/usr/bin/env node
/**
 * Publica una versión nueva de la app en el sitio del simulador: copia el APK firmado y su .sha256 y escribe
 * `version.json`, que es lo que consulta la app para avisar "hay una versión nueva".
 *
 * Antes: subir `version` y `android.versionCode` en app.json, compilar y firmar el APK (queda en dist/vrlexo-control.apk).
 *
 * Uso:   node tools/publicar_version.js [carpeta_destino]
 *        (por defecto ../vrLexo/public/app, el repo hermano del simulador)
 *        npm run publicar-version
 *
 * Después: commit + push en el repo del simulador y `bash deploy.sh` en vm5.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const destino = path.resolve(process.argv[2] || path.join(raiz, '..', 'vrLexo', 'public', 'app'));
const apk = path.join(raiz, 'dist', 'vrlexo-control.apk');

function fallar(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(apk)) fallar(`no está ${apk}. Compilá y firmá el APK primero (ver README: "Compilar el APK en la PC").`);
if (!fs.existsSync(path.join(destino, 'index.html'))) fallar(`${destino} no parece la carpeta public/app del simulador (falta index.html).`);

const expo = JSON.parse(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8')).expo;
const versionName = expo.version;
const versionCode = expo.android && expo.android.versionCode;
if (!versionName || !Number.isInteger(versionCode)) fallar('app.json no tiene version y android.versionCode.');

const config = fs.readFileSync(path.join(raiz, 'src', 'config.ts'), 'utf8');
const url = (/URL_DESCARGA_APK\s*=\s*'([^']+)'/.exec(config) || [])[1];
if (!url) fallar('no encontré URL_DESCARGA_APK en src/config.ts.');

// No pisar una versión mayor ya publicada (evita publicar por error un APK viejo).
const archivoVersion = path.join(destino, 'version.json');
if (fs.existsSync(archivoVersion)) {
  try {
    const previa = JSON.parse(fs.readFileSync(archivoVersion, 'utf8'));
    if (Number.isInteger(previa.versionCode) && previa.versionCode > versionCode) {
      fallar(`ya hay publicada la versionCode ${previa.versionCode}, mayor que la de app.json (${versionCode}). Subí la versión en app.json.`);
    }
  } catch {
    /* version.json roto: se reescribe */
  }
}

const datos = fs.readFileSync(apk);
const sha256 = crypto.createHash('sha256').update(datos).digest('hex');
fs.copyFileSync(apk, path.join(destino, 'vrlexo-control.apk'));
fs.writeFileSync(path.join(destino, 'vrlexo-control.apk.sha256'), `${sha256}  vrlexo-control.apk\n`);
fs.writeFileSync(archivoVersion, JSON.stringify({ versionCode, versionName, url, sha256 }, null, 2) + '\n');

console.log(`Publicada la versión ${versionName} (versionCode ${versionCode}) en ${destino}`);
console.log(`  APK: ${(datos.length / 1048576).toFixed(1)} MB  sha256 ${sha256}`);
console.log('Falta: commit + push en el repo del simulador y bash deploy.sh en vm5.');
