const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = '/tmp/data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const IDEAS_DIR = path.join(DATA_DIR, 'ideas');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_USERS = 100;

function initData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(IDEAS_DIR)) fs.mkdirSync(IDEAS_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  } catch(e) {}
}
initData();

function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch(e) { return []; }
}
function writeJSON(fp, data) {
  try { fs.writeFileSync(fp, JSON.stringify(data, null, 2)); } catch(e) {}
}

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
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = { id: user.id, email: user.email, exp };
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
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, http-referer, x-title');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const originalUrl = req.headers['x-vercel-forwarded-url'] || req.url || '';

    // ── AUTH ──
    if (originalUrl === '/api/auth/register' && req.method === 'POST') {
      const body = JSON.parse((await getBody(req)).toString());
      const { email, password } = body;
      if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
      if (password.length < 6) { res.status(400).json({ error: 'Password must be 6+ chars' }); return; }
      const users = readJSON(USERS_FILE);
      if (users.length >= MAX_USERS) { res.status(403).json({ error: 'Registration cap reached (100 users)' }); return; }
      if (users.find(u => u.email === email)) { res.status(409).json({ error: 'Email already registered' }); return; }
      const user = { id: crypto.randomUUID(), email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
      users.push(user);
      writeJSON(USERS_FILE, users);
      const token = createToken(user);
      res.status(200).json({ token, user: { id: user.id, email: user.email } });
      return;
    }

    if (originalUrl === '/api/auth/login' && req.method === 'POST') {
      const body = JSON.parse((await getBody(req)).toString());
      const { email, password } = body;
      if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
      const users = readJSON(USERS_FILE);
      const user = users.find(u => u.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: 'Invalid email or password' }); return; }
      const token = createToken(user);
      res.status(200).json({ token, user: { id: user.id, email: user.email } });
      return;
    }

    if (originalUrl === '/api/auth/me' && req.method === 'GET') {
      const payload = verifyToken(req.headers['authorization'] || '');
      if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
      res.status(200).json({ user: { id: payload.id, email: payload.email } });
      return;
    }

    if (originalUrl === '/api/auth/stats' && req.method === 'GET') {
      const users = readJSON(USERS_FILE);
      res.status(200).json({ totalUsers: users.length, maxUsers: MAX_USERS });
      return;
    }

    // ── IDEAS SYNC ──
    if (originalUrl === '/api/ideas/sync' && req.method === 'POST') {
      const payload = verifyToken(req.headers['authorization'] || '');
      if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
      const body = JSON.parse((await getBody(req)).toString());
      const ideasFile = path.join(IDEAS_DIR, payload.id + '.json');
      writeJSON(ideasFile, body.ideas || []);
      res.status(200).json({ ok: true, count: (body.ideas || []).length });
      return;
    }

    if (originalUrl === '/api/ideas/sync' && req.method === 'GET') {
      const payload = verifyToken(req.headers['authorization'] || '');
      if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
      const ideasFile = path.join(IDEAS_DIR, payload.id + '.json');
      const ideas = readJSON(ideasFile);
      res.status(200).json({ ideas });
      return;
    }

    // ── PROXY ──
    let targetHost, prefix, replacement;
    if (originalUrl.startsWith('/zen-proxy/')) {
      targetHost = 'opencode.ai';
      prefix = '/zen-proxy';
      replacement = '/zen';
    } else if (originalUrl.startsWith('/gh-proxy/')) {
      targetHost = 'api.github.com';
      prefix = '/gh-proxy';
      replacement = '';
    } else {
      res.status(404).json({ error: 'Not found: ' + originalUrl });
      return;
    }

    const apiPath = originalUrl.replace(prefix, replacement);
    const body = await getBody(req);

    return new Promise(resolve => {
      const options = {
        hostname: targetHost,
        path: apiPath,
        method: req.method,
        headers: {
          'host': targetHost,
          'user-agent': 'RepoCollider/1.0',
          'accept': 'application/json',
        },
      };
      if (body.length) {
        options.headers['content-type'] = req.headers['content-type'] || 'application/json';
        options.headers['content-length'] = body.length;
      }
      ['authorization', 'x-api-key', 'anthropic-version',
       'anthropic-dangerous-direct-browser-access', 'http-referer', 'x-title']
        .forEach(h => { if (req.headers[h]) options.headers[h] = req.headers[h]; });

      const proxyReq = https.request(options, proxyRes => {
        const chunks = [];
        proxyRes.on('data', c => chunks.push(c));
        proxyRes.on('end', () => {
          res.status(proxyRes.statusCode).send(Buffer.concat(chunks));
          resolve();
        });
      });
      proxyReq.on('error', e => {
        res.status(502).json({ error: 'Proxy error: ' + e.message });
        resolve();
      });
      if (body.length) proxyReq.write(body);
      proxyReq.end();
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};
