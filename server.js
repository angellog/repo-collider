const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTML_FILE = path.resolve(__dirname, 'repo-collider.html');
const MIGRATE_FILE = path.resolve(__dirname, 'migrate.html');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

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
  const bodyChunks = [];

  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks);
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: apiPath,
      method: req.method,
      headers: {
        'host': targetHost,
        'content-type': req.headers['content-type'] || 'application/json',
        'content-length': body.length,
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

  req.on('error', (e) => {
    res.writeHead(400, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('Request error: ' + e.message);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, http-referer, x-title');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
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

  // POST endpoint: save localStorage backup from migrate page
  if (req.url === '/api/backup' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const filePath = path.resolve(__dirname, 'backup-data.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('Backup saved to', filePath);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ok:true, keys: Object.keys(data).filter(k=>k.startsWith('rc-')).length}));
      } catch(e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ok:false, error: e.message}));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
