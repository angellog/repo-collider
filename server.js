const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTML_FILE = path.resolve(__dirname, 'repo-collider.html');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyToZen(req, res) {
    const zenPath = req.url.replace('/zen-proxy', '/zen');
  const bodyChunks = [];

  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks);
    const options = {
      hostname: 'opencode.ai',
      port: 443,
      path: zenPath,
      method: req.method,
      headers: {
        'host': 'opencode.ai',
        'content-type': req.headers['content-type'] || 'application/json',
        'content-length': body.length,
        'authorization': req.headers['authorization'] || '',
        'x-api-key': req.headers['x-api-key'] || '',
        'anthropic-version': req.headers['anthropic-version'] || '',
        'anthropic-dangerous-direct-browser-access': req.headers['anthropic-dangerous-direct-browser-access'] || '',
      },
    };

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url.startsWith('/zen-proxy/')) {
    proxyToZen(req, res);
    return;
  }

  if (req.url === '/' || req.url === '/repo-collider.html') {
    serveStatic(res, HTML_FILE);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
