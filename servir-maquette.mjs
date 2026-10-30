import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const shouldOpen = process.argv.includes('--open');
const wifi = process.argv.includes('--wifi');
const wifiInterface = Object.entries(os.networkInterfaces()).find(([name,entries]) => /wi-?fi|wireless|wlan/i.test(name) && entries.some(e=>e.family==='IPv4'&&!e.internal));
if(wifi&&!wifiInterface){console.error('Aucune adresse Wi-Fi IPv4 disponible. Connectez ce PC au Wi-Fi.');process.exit(1);}
const wifiAddress=wifi?wifiInterface[1].find(e=>e.family==='IPv4'&&!e.internal):null;
const host=wifiAddress?.address||'127.0.0.1';
let port = wifi ? 5183 : 5181;
const address = () => `http://${host}:${port}/`;
const ipv4Number=ip=>ip.split('.').reduce((n,v)=>(n<<8)|Number(v),0)>>>0;
function sameNetwork(ip){const remote=ip?.replace(/^::ffff:/,'');return /^\d+\.\d+\.\d+\.\d+$/.test(remote||'') && ((ipv4Number(remote)&ipv4Number(wifiAddress.netmask))===(ipv4Number(host)&ipv4Number(wifiAddress.netmask)));}
// Certains Wi-Fi routent leurs clients entre plusieurs sous-réseaux privés.
function localNetworkClient(ip){
  const remote=ip?.replace(/^::ffff:/,'');
  if(!/^\d+\.\d+\.\d+\.\d+$/.test(remote||''))return false;
  const octets=remote.split('.').map(Number);
  if(octets.some(n=>n>255))return false;
  return sameNetwork(remote)||octets[0]===10||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)||(octets[0]===192&&octets[1]===168)||remote==='127.0.0.1';
}
function openBrowser() {
  if (!shouldOpen) return;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${address()}'`], { windowsHide: true }, error => {
    if (error) console.log(`Ouvrez cette adresse dans votre navigateur : ${address()}`);
  });
}
async function isThisMockup() {
  try {
    // Compatible aussi avec le serveur démarré avant cette correction.
    const response = await fetch(address(), { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return false;
    const remote = Buffer.from(await response.arrayBuffer());
    const local = await fs.readFile(path.join(root, 'index.html'));
    if (!remote.equals(local)) return false;
    const asset = local.toString().match(/src="(\/assets\/[^"?]+\.js)"/);
    if (!asset) return false;
    const assetResponse = await fetch(new URL(asset[1], address()), { signal: AbortSignal.timeout(2500) });
    return assetResponse.ok && Buffer.from(await assetResponse.arrayBuffer()).equals(await fs.readFile(path.join(root, asset[1])));
  } catch { return false; }
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
try { await fs.access(path.join(root, 'index.html')); }
catch { console.error('La version compilée manque. Exécutez npm run build.'); process.exit(1); }
const server = http.createServer(async (req, res) => {
  try {
    if(wifi&&!localNetworkClient(req.socket.remoteAddress)){console.log(`Accès refusé pour ${req.socket.remoteAddress}`);res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('Accès limité au réseau local.');}
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (!path.extname(pathname)) file = path.join(root, 'index.html');
    const content = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      // La maquette ne peut appeler ni le backend RH ni une autre API.
      'Content-Security-Policy': "connect-src 'none'; frame-src 'self' blob:; object-src 'self' blob:",
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Fichier introuvable.'); }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    if (await isThisMockup()) {
      console.log(`La maquette est déjà démarrée : ${address()}`);
      openBrowser();
      return;
    }
    if (!wifi && port < 5200) {
      console.log(`Le port ${port} est occupé par un autre service. Recherche d’un port libre…`);
      port++;
      server.listen(port, host);
      return;
    }
  }
  console.error(error.message);
  process.exitCode = 1;
});
server.on('listening', () => {
  console.log(`Maquette RH${wifi?' · accès Wi-Fi local':''} : ${address()}\nGardez cette fenêtre ouverte. Fermez-la ou utilisez Ctrl+C pour arrêter.`);
  openBrowser();
});
server.listen(port, host);
