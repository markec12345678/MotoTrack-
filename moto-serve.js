const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE = path.resolve(__dirname);

// ─── Load HTML ────────────────────────────────────────────────
let INDEX_HTML;
try { INDEX_HTML = fs.readFileSync(path.join(BASE, '.next', 'cached-index.html')); }
catch(e) { INDEX_HTML = Buffer.from('<html><body><h1>MotoTrack</h1></body></html>'); }

// ─── MIME types ───────────────────────────────────────────────
const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webp': 'image/webp', '.map': 'application/json', '.txt': 'text/plain',
  '.html': 'text/html', '.wasm': 'application/wasm',
};

// ─── Preload all static files into memory ─────────────────────
const cache = new Map();
let fileCount = 0;
let totalBytes = 0;

function loadFile(fp) {
  if (cache.has(fp)) return cache.get(fp);
  try {
    if (!fs.existsSync(fp)) return null;
    const data = fs.readFileSync(fp);
    const ext = path.extname(fp).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    const entry = { data, ct };
    cache.set(fp, entry);
    totalBytes += data.length;
    return entry;
  } catch(e) { return null; }
}

function walkDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      try {
        const st = fs.statSync(fp);
        if (st.isDirectory()) walkDir(fp);
        else { loadFile(fp); fileCount++; }
      } catch(e) {}
    }
  } catch(e) {}
}

walkDir(path.join(BASE, '.next', 'static'));
walkDir(path.join(BASE, 'public'));

// ─── Pre-serialize API responses ──────────────────────────────
const MOCK_USER = {
  id: 'demo1', name: 'Miran M.', email: 'miran@rever.si',
  avatar: null, bike: 'Yamaha MT-07', bio: 'Motociklistični navdušenec'
};

const MOCK_RIDES = [
  { id: 'r1', title: 'Vožnja po Gorenjskem', distance: 127.5, duration: 7200, avgSpeed: 63.8, maxSpeed: 118, elevation: 1850, startLat: 46.2397, startLng: 14.3514, endLat: 46.3628, endLng: 14.0958, isPublic: true, createdAt: '2025-05-10T08:00:00Z', userId: 'demo1' },
  { id: 'r2', title: 'Prelaz Vršič', distance: 89.3, duration: 5400, avgSpeed: 59.5, maxSpeed: 95, elevation: 2100, startLat: 46.2512, startLng: 13.7614, endLat: 46.3317, endLng: 13.8756, isPublic: true, createdAt: '2025-05-08T09:00:00Z', userId: 'demo1' },
  { id: 'r3', title: 'Obala - Piran do Koper', distance: 45.2, duration: 2700, avgSpeed: 60.3, maxSpeed: 88, elevation: 320, startLat: 45.5297, startLng: 13.5667, endLat: 45.5469, startLng: 13.7294, isPublic: true, createdAt: '2025-05-05T10:00:00Z', userId: 'demo1' },
];

const MOCK_ROUTES = [
  { id: 'rt1', title: 'Julijske Alpe - krog', description: 'Krožna pot po Julijskih Alpah', distance: 185, category: 'scenic', difficulty: 'hard', likes: 12, userLiked: false, isPublic: true, createdAt: '2025-05-01T00:00:00Z', userId: 'demo1' },
  { id: 'rt2', title: 'Prelazi Slovenije', description: 'Najlepši slovenski prelazi', distance: 220, category: 'twisty', difficulty: 'medium', likes: 8, userLiked: false, isPublic: true, createdAt: '2025-04-28T00:00:00Z', userId: 'demo1' },
];

const MOCK_LEADERBOARD = [
  { id: 'demo1', name: 'Miran M.', totalDistance: 261.8, totalRides: 3 },
  { id: 'u2', name: 'Ana K.', totalDistance: 450.2, totalRides: 5 },
  { id: 'u3', name: 'Boris P.', totalDistance: 180.0, totalRides: 2 },
];

// Pre-serialize all API responses as Buffers for zero-copy serving
const API_GET_RAW = {};
const apiData = {
  '/api/init': { users: [MOCK_USER], rides: MOCK_RIDES, routes: MOCK_ROUTES, defaultUser: MOCK_USER, needsSeed: false, leaderboard: MOCK_LEADERBOARD },
  '/api/notifications': [],
  '/api/achievements': { earned: [], newlyEarned: [] },
  '/api/sos': { ok: true },
  '/api/seed': { seeded: false },
  '/api/leaderboard': MOCK_LEADERBOARD,
  '/api/rides': MOCK_RIDES,
  '/api/routes': MOCK_ROUTES,
  '/api/comments': [],
  '/api/settings': { unitSystem: 'metric', autoPauseEnabled: true, autoPauseSpeedThreshold: 5, wakelockEnabled: true, hideStartEnd: false },
  '/api/stats': { totalRides: 3, totalDistance: 261.8, totalDuration: 15300, avgSpeed: 61.2, maxSpeed: 118 },
  '/api/weather': null,
  '/api/fuel': [],
  '/api/fuel-prices': [],
  '/api/balkan-roads': [],
  '/api/events': [],
  '/api/challenges': [],
  '/api/favorites': [],
  '/api/friends': [],
  '/api/ride-score': { score: 0, breakdown: {} },
  '/api/curvy-roads': [],
  '/api/map-styles': [],
  '/api/camps': [],
  '/api/expenses': [],
  '/api/videos': [],
  '/api/subscription': { plan: 'free' },
};

for (const [key, val] of Object.entries(apiData)) {
  API_GET_RAW[key] = Buffer.from(JSON.stringify({ data: val }));
}

// ─── Common headers as strings for speed ──────────────────────
const HDR_HTML = 'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: public, max-age=60\r\nConnection: close\r\n';
const HDR_JSON = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: public, max-age=30\r\nConnection: close\r\n';
const HDR_404 = 'HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found';
const HDR_SW = Buffer.from('self.addEventListener("fetch",function(){});');

// ─── Request handler ──────────────────────────────────────────
let reqCount = 0;

const server = http.createServer((req, res) => {
  reqCount++;
  const urlPath = req.url.split('?')[0];

  try {
    // Root HTML
    if (urlPath === '/' || urlPath === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'Connection': 'close' });
      return res.end(INDEX_HTML);
    }

    // Static files from .next
    if (urlPath.startsWith('/_next/static/')) {
      const fp = path.join(BASE, '.next', 'static', urlPath.replace('/_next/static/', ''));
      const f = cache.get(fp);
      if (f) {
        res.writeHead(200, { 'Content-Type': f.ct, 'Cache-Control': 'public, max-age=31536000, immutable', 'Connection': 'close' });
        return res.end(f.data);
      }
      const f2 = loadFile(fp);
      if (f2) {
        res.writeHead(200, { 'Content-Type': f2.ct, 'Cache-Control': 'public, max-age=31536000, immutable', 'Connection': 'close' });
        return res.end(f2.data);
      }
      res.writeHead(404, { 'Connection': 'close' });
      return res.end('Not Found');
    }

    // API routes - use pre-serialized buffers
    if (urlPath.startsWith('/api/')) {
      const raw = API_GET_RAW[urlPath];
      if (raw) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30', 'Connection': 'close' });
        return res.end(raw);
      }
      // Unknown API endpoint
      res.writeHead(200, { 'Content-Type': 'application/json', 'Connection': 'close' });
      return res.end('{"data":null}');
    }

    // Service worker
    if (urlPath === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache', 'Connection': 'close' });
      return res.end(HDR_SW);
    }

    // Public files
    const fp = path.join(BASE, 'public', urlPath.replace(/^\//, ''));
    const f = cache.get(fp) || loadFile(fp);
    if (f) {
      res.writeHead(200, { 'Content-Type': f.ct, 'Cache-Control': 'public, max-age=3600', 'Connection': 'close' });
      return res.end(f.data);
    }

    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'Connection': 'close' });
    return res.end(INDEX_HTML);
  } catch(e) {
    try { res.writeHead(500, { 'Connection': 'close' }); res.end('Error'); } catch(e2) {}
  }
});

server.listen(PORT, () => {
  const usage = process.memoryUsage();
  console.log(`[MotoTrack] Server on :${PORT} | ${fileCount} files (${(totalBytes/1024/1024).toFixed(1)}MB) | RSS: ${Math.round(usage.rss/1024/1024)}MB`);
});

server.on('error', (e) => { console.error('[MotoTrack] Server error:', e.message); });
process.on('uncaughtException', (e) => { console.error('[MotoTrack] Uncaught:', e.message); });

// Minimal stats logging
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`[MotoTrack] reqs=${reqCount} RSS=${Math.round(usage.rss/1024/1024)}MB`);
}, 30000);
