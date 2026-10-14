// Serves the exported static web build in dist/.
//
// Replaces the previous start-web.js, which ran `expo start --web --clear` - the
// Metro *development* server - permanently under PM2. That cost ~1 GB of RAM
// across 9 processes (a parent plus 8 jest-worker transformers), re-bundled the
// whole app on every restart because of --clear, and exposed a dev bundler on
// all interfaces. A static export needs none of that.
//
// Build first:  npx expo export --platform web
// Then:         node serve-web.js
//
// Env:
//   UKULELE_REMOTE_PORT  (default 8081 - unchanged, so existing clients keep working)
//   UKULELE_REMOTE_HOST  (default 0.0.0.0 - LAN reachable over IPv4. The dev server
//                         used to bind '::', which also exposed IPv6; set this to
//                         127.0.0.1 if you ever want it local-only.)
//
// No dependencies: node builtins only, so this runs fine under the
// --max-old-space-size=128 cap set in ukulele-remote.config.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');

const assetCache = new Map();

const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.env.UKULELE_REMOTE_PORT) || 8081;
const HOST = process.env.UKULELE_REMOTE_HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(ROOT)) {
  console.error(
    `[ukulele-remote] dist/ not found at ${ROOT}.\n` +
      `Run "npx expo export --platform web" before starting this server.`
  );
  process.exit(1);
}

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

// Resolve a request path to a file inside dist/, or null if it escapes the root.
// expo-router's static export writes one .html per route (index, modal,
// _sitemap, +not-found), so "/modal" resolves to "modal.html".
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }

  const candidate = path.resolve(ROOT, '.' + path.posix.normalize(decoded));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) {
    return null; // traversal attempt
  }

  if (isFile(candidate)) return candidate;
  if (isFile(candidate + '.html')) return candidate + '.html';

  const asIndex = path.join(candidate, 'index.html');
  if (isFile(asIndex)) return asIndex;

  return null;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  let file = resolveFile(req.url || '/');
  let status = 200;

  if (!file) {
    // Unknown route: hand back the router's not-found page so client-side
    // routing still works, but with an honest status code.
    const notFound = path.join(ROOT, '+not-found.html');
    file = isFile(notFound) ? notFound : path.join(ROOT, 'index.html');
    status = 404;
  }

  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  // Asset filenames carry a content hash, so they can be cached hard. Non-hashed
  // root files (like favicon.ico) should revalidate, and HTML must not be cached.
  const isHashedAsset = file.includes('_expo') || file.includes('assets');
  headers['Cache-Control'] = ext === '.html'
    ? 'no-cache'
    : isHashedAsset
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600, must-revalidate';

  fs.stat(file, (err, stat) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Internal Server Error');
    }

    if (req.method === 'HEAD') {
      headers['Content-Length'] = stat.size;
      res.writeHead(status, headers);
      return res.end();
    }

    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Only compress compressible text/script/style/json assets
    const compressible = /^(text\/|application\/(javascript|json|xml))/i.test(MIME[ext] || '');

    if (compressible && acceptEncoding.match(/\bbr\b/)) {
      headers['Content-Encoding'] = 'br';
      const cached = assetCache.get(file + ':br');
      if (cached) {
        headers['Content-Length'] = cached.length;
        res.writeHead(status, headers);
        return res.end(cached);
      }
      const compressor = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        }
      });
      const chunks = [];
      compressor.on('data', c => chunks.push(c));
      compressor.on('end', () => {
        if (isHashedAsset && chunks.length > 0) assetCache.set(file + ':br', Buffer.concat(chunks));
      });
      res.writeHead(status, headers);
      pipeline(fs.createReadStream(file), compressor, res, () => {});
    } else if (compressible && acceptEncoding.match(/\bgzip\b/)) {
      headers['Content-Encoding'] = 'gzip';
      const cached = assetCache.get(file + ':gzip');
      if (cached) {
        headers['Content-Length'] = cached.length;
        res.writeHead(status, headers);
        return res.end(cached);
      }
      const compressor = zlib.createGzip({ level: 6 });
      const chunks = [];
      compressor.on('data', c => chunks.push(c));
      compressor.on('end', () => {
        if (isHashedAsset && chunks.length > 0) assetCache.set(file + ':gzip', Buffer.concat(chunks));
      });
      res.writeHead(status, headers);
      pipeline(fs.createReadStream(file), compressor, res, () => {});
    } else {
      headers['Content-Length'] = stat.size;
      res.writeHead(status, headers);
      pipeline(fs.createReadStream(file), res, () => {});
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[ukulele-remote] serving ${ROOT} on http://${HOST}:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[ukulele-remote] ${sig} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
