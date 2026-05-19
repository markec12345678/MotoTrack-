import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Load HTML once (small, keep in memory)
let INDEX_HTML;
try {
  INDEX_HTML = fs.readFileSync(path.join(__dirname, '.next', 'cached-index.html'));
} catch {
  INDEX_HTML = Buffer.from('<html><body><h1>MotoTrack</h1><p>Building...</p></body></html>');
}

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
};

// Small file cache only (< 100KB)
const cache = new Map();
const MAX_CACHE_SIZE = 100_000;

function getContentType(fp) {
  const ext = path.extname(fp).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function serveFile(fp, res, maxAge) {
  try {
    // Check cache first
    if (cache.has(fp)) {
      const { data, ct } = cache.get(fp);
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': `public, max-age=${maxAge}` });
      res.end(data);
      return;
    }
    
    // Check if file exists
    if (!fs.existsSync(fp)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    
    const stat = fs.statSync(fp);
    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    
    const ct = getContentType(fp);
    
    // Small files: cache in memory
    if (stat.size < MAX_CACHE_SIZE) {
      const data = fs.readFileSync(fp);
      cache.set(fp, { data, ct });
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': `public, max-age=${maxAge}`, 'Content-Length': stat.size });
      res.end(data);
      return;
    }
    
    // Large files: stream from disk
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': `public, max-age=${maxAge}`, 'Content-Length': stat.size });
    const stream = fs.createReadStream(fp);
    pipeline(stream, res, (err) => {
      if (err) stream.destroy();
    });
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
}

// Preload small files only
function preloadSmall() {
  let count = 0;
  const dirs = [
    path.join(__dirname, '.next', 'static'),
    path.join(__dirname, 'public'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      try {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const fp = path.join(d, entry.name);
          if (entry.isDirectory()) walk(fp);
          else if (entry.isFile()) {
            try {
              const stat = fs.statSync(fp);
              if (stat.size < MAX_CACHE_SIZE) {
                const ct = getContentType(fp);
                const data = fs.readFileSync(fp);
                cache.set(fp, { data, ct });
                count++;
              }
            } catch {}
          }
        }
      } catch {}
    };
    walk(dir);
  }
  return count;
}

const MOCK_USER = { id: 'demo1', name: 'Miran M.', email: 'miran@rever.si', avatar: null, bike: 'Yamaha MT-07', bio: 'Motociklisticni navdusenec' };

const API_GET = {
  '/api/init': () => ({ users: [MOCK_USER], rides: [], routes: [], defaultUser: MOCK_USER, needsSeed: false, leaderboard: [{ id: 'demo1', name: 'Miran M.', totalDistance: 0, totalRides: 0 }] }),
  '/api/notifications': () => [],
  '/api/achievements': () => ({ earned: [], newlyEarned: [] }),
  '/api/sos': () => ({ ok: true }),
  '/api/seed': () => ({ seeded: false }),
  '/api/leaderboard': () => [{ id: 'demo1', name: 'Miran M.', totalDistance: 0, totalRides: 0 }],
  '/api/rides': () => [],
  '/api/routes': () => [],
  '/api/comments': () => [],
  '/api/settings': () => ({ unitSystem: 'metric', autoPauseEnabled: true, autoPauseSpeedThreshold: 5, wakelockEnabled: true, hideStartEnd: false }),
  '/api/stats': () => ({ totalRides: 0, totalDistance: 0, totalDuration: 0, avgSpeed: 0, maxSpeed: 0 }),
  '/api/weather': () => null,
  '/api/fuel': () => [],
  '/api/fuel-prices': () => [],
  '/api/balkan-roads': () => [],
  '/api/events': () => [],
  '/api/challenges': () => [],
  '/api/favorites': () => [],
  '/api/friends': () => [],
  '/api/ride-score': () => ({ score: 0, breakdown: {} }),
  '/api/curvy-roads': () => [],
  '/api/map-styles': () => [],
  '/api/camps': () => [],
  '/api/expenses': () => [],
  '/api/videos': () => [],
  '/api/subscription': () => ({ plan: 'free' }),
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = req.url.split('?')[0];
    
    if (urlPath === '/' || urlPath === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
      res.end(INDEX_HTML);
      return;
    }
    
    if (urlPath.startsWith('/_next/static/')) {
      const fp = path.join(__dirname, '.next', 'static', urlPath.replace('/_next/static/', ''));
      serveFile(fp, res, 31536000);
      return;
    }
    
    if (urlPath.startsWith('/api/')) {
      const handler = API_GET[urlPath];
      const data = handler ? handler() : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data }));
      return;
    }
    
    if (urlPath === '/sw.js') {
      const fp = path.join(__dirname, 'public', 'sw.js');
      serveFile(fp, res, 0);
      return;
    }
    
    // Try public folder
    const fp = path.join(__dirname, 'public', urlPath.slice(1));
    serveFile(fp, res, 3600);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

const count = preloadSmall();
server.listen(PORT, () => {
  console.log(`> MotoTrack v10 on :${PORT} | ${count} small files cached | streaming large files`);
});
