import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createStaticServer, isHashedAssetFile } = require('../../serve-web.js');

function httpGet(port: number, urlPath: string, headers: Record<string, string> = {}): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('serve-web static server hardening', () => {
  let tmpRoot: string;
  let server: http.Server;
  let port: number;
  let cache: Map<string, Buffer>;

  beforeEach(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ukulele-serve-test-'));
    fs.mkdirSync(path.join(tmpRoot, '_expo', 'static', 'js', 'web'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'assets', 'fonts'), { recursive: true });

    fs.writeFileSync(path.join(tmpRoot, 'index.html'), '<!doctype html><html><body>Ukulele</body></html>');
    fs.writeFileSync(path.join(tmpRoot, '+not-found.html'), '<!doctype html><html><body>Not Found</body></html>');
    fs.writeFileSync(path.join(tmpRoot, '_expo', '.routes.json'), JSON.stringify({ routes: ['/'] }));
    fs.writeFileSync(
      path.join(tmpRoot, '_expo', 'static', 'js', 'web', 'entry-abcdef123456.js'),
      'console.log("hashed bundle");'
    );
    fs.writeFileSync(path.join(tmpRoot, 'assets', 'fonts', 'Ionicons.123456.ttf'), Buffer.from([0, 1, 2, 3]));

    cache = new Map();
    server = createStaticServer(tmpRoot, cache);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('classifies only _expo/static/ and assets/ as immutable hashed assets, excluding _expo/.routes.json', () => {
    expect(isHashedAssetFile(path.join(tmpRoot, '_expo', 'static', 'js', 'web', 'entry-abcdef123456.js'), tmpRoot)).toBe(true);
    expect(isHashedAssetFile(path.join(tmpRoot, 'assets', 'fonts', 'Ionicons.123456.ttf'), tmpRoot)).toBe(true);
    expect(isHashedAssetFile(path.join(tmpRoot, '_expo', '.routes.json'), tmpRoot)).toBe(false);
    expect(isHashedAssetFile(path.join(tmpRoot, 'index.html'), tmpRoot)).toBe(false);
  });

  it('sets Vary: Accept-Encoding on br and gzip responses and caches only hashed assets', async () => {
    // 1. Hashed JS bundle with Brotli -> immutable + Vary: Accept-Encoding + cached in memory
    const brRes = await httpGet(port, '/_expo/static/js/web/entry-abcdef123456.js', {
      'Accept-Encoding': 'br, gzip',
    });
    expect(brRes.statusCode).toBe(200);
    expect(brRes.headers['content-encoding']).toBe('br');
    expect(brRes.headers['vary']).toBe('Accept-Encoding');
    expect(brRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(zlib.brotliDecompressSync(brRes.body).toString('utf8')).toBe('console.log("hashed bundle");');
    expect(cache.size).toBe(1);

    // 1b. Second request hits in-memory cache with deterministic Content-Length
    const brHitRes = await httpGet(port, '/_expo/static/js/web/entry-abcdef123456.js', {
      'Accept-Encoding': 'br, gzip',
    });
    expect(brHitRes.statusCode).toBe(200);
    expect(brHitRes.headers['content-encoding']).toBe('br');
    expect(brHitRes.headers['vary']).toBe('Accept-Encoding');
    expect(brHitRes.headers['content-length']).toBe(String(brRes.body.length));
    expect(brHitRes.body.equals(brRes.body)).toBe(true);

    // 2. Unhashed _expo/.routes.json with Gzip -> must-revalidate (NOT immutable), Vary: Accept-Encoding, NOT cached in memory
    const routesRes = await httpGet(port, '/_expo/.routes.json', {
      'Accept-Encoding': 'gzip',
    });
    expect(routesRes.statusCode).toBe(200);
    expect(routesRes.headers['content-encoding']).toBe('gzip');
    expect(routesRes.headers['vary']).toBe('Accept-Encoding');
    expect(routesRes.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
    expect(zlib.gunzipSync(routesRes.body).toString('utf8')).toBe('{"routes":["/"]}');
    expect(cache.size).toBe(1);

    // 3. HTML index with Brotli -> no-cache, Vary: Accept-Encoding, NOT cached in memory
    const htmlRes = await httpGet(port, '/', {
      'Accept-Encoding': 'br',
    });
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.headers['content-encoding']).toBe('br');
    expect(htmlRes.headers['vary']).toBe('Accept-Encoding');
    expect(htmlRes.headers['cache-control']).toBe('no-cache');
    expect(cache.size).toBe(1);
  });
});
