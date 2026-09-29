// CS2 Class Ranking backend. No npm packages needed (Node 18+).
// Run:  ADMIN_PASSWORD=yourpassword node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD;
const DATA_FILE = path.join(__dirname, 'data.json');
const INDEX = path.join(__dirname, 'public', 'index.html');

if (!PASSWORD) {
  console.error('Set ADMIN_PASSWORD first, e.g.  ADMIN_PASSWORD=secret node server.js');
  process.exit(1);
}

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { players: [{ id: 'p1', name: 'Player One', score: 1000 }] }; }
}
function save(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const real = Buffer.from(PASSWORD);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function clean(players) {
  if (!Array.isArray(players) || players.length > 200) return null;
  const out = [];
  for (const p of players) {
    if (!p || typeof p.name !== 'string' || !Number.isFinite(p.score)) return null;
    out.push({
      id: String(p.id || crypto.randomUUID()).slice(0, 40),
      name: p.name.trim().slice(0, 24),
      score: Math.round(p.score),
    });
  }
  return out;
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/players') return send(res, 200, load());

  if (req.method === 'POST' && url === '/api/login') {
    if (isAdmin(req)) return send(res, 200, { ok: true });
    return setTimeout(() => send(res, 401, { error: 'wrong password' }), 800); // slow brute force
  }

  if (req.method === 'PUT' && url === '/api/players') {
    if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      let players;
      try { players = clean(JSON.parse(body).players); } catch { players = null; }
      if (!players) return send(res, 400, { error: 'bad data' });
      const data = { players };
      save(data);
      send(res, 200, data);
    });
    return;
  }

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    return send(res, 200, fs.readFileSync(INDEX, 'utf8'), 'text/html; charset=utf-8');
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('Running on http://localhost:' + PORT));
