const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, http-referer, x-title');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const originalUrl = req.headers['x-vercel-forwarded-url'] || req.url;

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
    res.status(404).json({ error: 'Unknown proxy target: ' + originalUrl });
    return;
  }

  const apiPath = originalUrl.replace(prefix, replacement);

  const body = await new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

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
};
