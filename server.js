const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const HTML_FILE = path.resolve(__dirname, 'repo-collider.html');
const MIGRATE_FILE = path.resolve(__dirname, 'migrate.html');
const DATA_DIR = path.resolve(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const IDEAS_DIR = path.join(DATA_DIR, 'ideas');
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const MAX_USERS = 100;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

// ── DATA LAYER ──
function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(IDEAS_DIR)) fs.mkdirSync(IDEAS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
}
initData();

function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch(e) { return []; }
}
function writeJSON(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

// ── AUTH ──
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex') === hash;
}
function createToken(user) {
  const payload = { id: user.id, email: user.email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
  return b64 + '.' + sig;
}
function verifyToken(token) {
  try {
    const [b64, sig] = token.replace('Bearer ', '').split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch(e) { return null; }
}

function getBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}

async function handleAuth(req, res) {
  const url = req.url;
  const method = req.method;

  if (url === '/api/auth/register' && method === 'POST') {
    const body = JSON.parse(await getBody(req));
    const { email, password } = body;
    if (!email || !password) return json(res, 400, { error: 'Email and password required' });
    if (password.length < 6) return json(res, 400, { error: 'Password must be 6+ chars' });
    const users = readJSON(USERS_FILE);
    if (users.length >= MAX_USERS) return json(res, 403, { error: 'Registration cap reached (100 users). Join the waitlist.' });
    if (users.find(u => u.email === email)) return json(res, 409, { error: 'Email already registered' });
    const user = { id: crypto.randomUUID(), email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    users.push(user);
    writeJSON(USERS_FILE, users);
    const token = createToken(user);
    return json(res, 200, { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
  }

  if (url === '/api/auth/login' && method === 'POST') {
    const body = JSON.parse(await getBody(req));
    const { email, password } = body;
    if (!email || !password) return json(res, 400, { error: 'Email and password required' });
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return json(res, 401, { error: 'Invalid email or password' });
    const token = createToken(user);
    return json(res, 200, { token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
  }

  if (url === '/api/auth/me' && method === 'GET') {
    const payload = verifyToken(req.headers['authorization'] || '');
    if (!payload) return json(res, 401, { error: 'Invalid or expired token' });
    return json(res, 200, { user: { id: payload.id, email: payload.email } });
  }

  if (url === '/api/auth/stats' && method === 'GET') {
    const users = readJSON(USERS_FILE);
    return json(res, 200, { totalUsers: users.length, maxUsers: MAX_USERS });
  }

  // Ideas sync
  if (url === '/api/ideas/sync' && method === 'POST') {
    const payload = verifyToken(req.headers['authorization'] || '');
    if (!payload) return json(res, 401, { error: 'Invalid or expired token' });
    const body = JSON.parse(await getBody(req));
    const ideasFile = path.join(IDEAS_DIR, payload.id + '.json');
    writeJSON(ideasFile, body.ideas || []);
    return json(res, 200, { ok: true, count: (body.ideas || []).length });
  }

  if (url === '/api/ideas/sync' && method === 'GET') {
    const payload = verifyToken(req.headers['authorization'] || '');
    if (!payload) return json(res, 401, { error: 'Invalid or expired token' });
    const ideasFile = path.join(IDEAS_DIR, payload.id + '.json');
    const ideas = readJSON(ideasFile);
    return json(res, 200, { ideas });
  }

  return false;
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyRequest(targetHost, targetPort, req, res, pathPrefix) {
  const apiPath = req.url.replace(pathPrefix, '');
  getBody(req).then(body => {
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: apiPath,
      method: req.method,
      headers: {
        'host': targetHost,
        'content-type': req.headers['content-type'] || 'application/json',
        'content-length': Buffer.byteLength(body),
        'authorization': req.headers['authorization'] || '',
        'user-agent': 'RepoCollider/1.0',
        'accept': 'application/json',
        'x-api-key': req.headers['x-api-key'] || '',
        'anthropic-version': req.headers['anthropic-version'] || '',
        'anthropic-dangerous-direct-browser-access': req.headers['anthropic-dangerous-direct-browser-access'] || '',
      },
    };
    if (req.headers['http-referer']) options.headers['http-referer'] = req.headers['http-referer'];
    if (req.headers['x-title']) options.headers['x-title'] = req.headers['x-title'];

    const proxyReq = https.request(options, (proxyRes) => {
      const responseHeaders = { ...proxyRes.headers };
      responseHeaders['access-control-allow-origin'] = '*';
      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
      res.end('Proxy error: ' + e.message);
    });
    proxyReq.write(body);
    proxyReq.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, http-referer, x-title');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth routes
  if (req.url.startsWith('/api/auth/') || req.url === '/api/ideas/sync') {
    const handled = await handleAuth(req, res);
    if (handled) return;
  }

  if (req.url.startsWith('/api/')) {
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (req.url.startsWith('/zen-proxy/')) {
    req.url = req.url.replace('/zen-proxy', '/zen');
    proxyRequest('opencode.ai', 443, req, res, '/zen-proxy');
    return;
  }

  if (req.url.startsWith('/gh-proxy/')) {
    proxyRequest('api.github.com', 443, req, res, '/gh-proxy');
    return;
  }

  if (req.url === '/' || req.url === '/repo-collider.html') {
    serveStatic(res, HTML_FILE);
    return;
  }

  if (req.url === '/migrate' || req.url === '/migrate.html') {
    serveStatic(res, MIGRATE_FILE);
    return;
  }

  if (req.url === '/api/backup' && req.method === 'POST') {
    const body = await getBody(req);
    try {
      const data = JSON.parse(body);
      const filePath = path.resolve(__dirname, 'backup-data.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log('Backup saved to', filePath);
      json(res, 200, { ok: true, keys: Object.keys(data).filter(k => k.startsWith('rc-')).length });
    } catch(e) {
      json(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
