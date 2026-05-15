#!/usr/bin/env node
/**
 * MotoTrack Ultra-Lightweight Server for Sandbox
 * 
 * Strategy: NO Prisma, NO Next.js runtime. Just static file serving + API stubs.
 * The client-side JavaScript handles empty data with loading states.
 * This keeps RSS at ~50MB which the sandbox allows.
 * 
 * For full API functionality, use the Vercel deployment.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = parseInt(process.env.PORT || '3000', 10);
process.on('uncaughtException', function(e) { console.error('[ERR]', e.message); });
process.on('unhandledRejection', function(r) { console.error('[REJECT]', String(r)); });

// Load cached HTML
var cachedIndex = null;
try {
  cachedIndex = fs.readFileSync(path.join(__dirname, '.next', 'cached-index.html'));
  console.log('[STATIC] Index: ' + cachedIndex.length + ' bytes');
} catch (e) {
  cachedIndex = Buffer.from('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoTrack</title></head><body><div id="__next"></div></body></html>');
}

var MIME = {
  '.js':'application/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff',
  '.webp':'image/webp','.wasm':'application/wasm','.map':'application/json',
  '.ttf':'font/ttf',
};

function serveFile(fp, res, maxAge) {
  try {
    if (!fs.existsSync(fp)) return false;
    var s = fs.statSync(fp);
    if (!s.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream',
      'Content-Length': s.size,
      'Cache-Control': 'public, max-age=' + (maxAge != null ? maxAge : 31536000),
    });
    var data = fs.readFileSync(fp); res.end(data);
    return true;
  } catch (e) { return false; }
}

// Lazy Prisma - only loaded when truly needed
var prisma = null;
var prismaLoading = false;
function getPrisma() {
  if (prisma) return prisma;
  if (prismaLoading) return null;
  prismaLoading = true;
  try {
    var { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ log: ['error'] });
    console.log('[DB] Prisma loaded, RSS=' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB');
    return prisma;
  } catch (e) {
    console.error('[DB] Prisma load failed:', e.message);
    return null;
  }
}

// Sample data for when Prisma isn't loaded yet
var sampleData = {
  users: [{ id: 'demo1', name: 'Miran M.', email: 'miran@rever.si', avatar: null, bike: 'Yamaha MT-07', bio: 'Motociklistični navdušenec' }],
  rides: [],
  routes: [],
  defaultUser: { id: 'demo1', name: 'Miran M.', email: 'miran@rever.si', avatar: null, bike: 'Yamaha MT-07', bio: 'Motociklistični navdušenec' },
  needsSeed: true,
  leaderboard: [{ id: 'demo1', name: 'Miran M.', totalDistance: 0, totalRides: 0 }],
};

var activeConns = 0;
var MAX_CONN = 10; // Process ONE request at a time!
var server = http.createServer(function(req, res) {
  activeConns++;
  if (activeConns > MAX_CONN) {
    activeConns--;
    res.writeHead(503, {'Content-Type': 'text/plain', 'Connection': 'close'});
    res.end('busy');
    return;
  }
  res.on('finish', function() { activeConns--; });
  res.on('close', function() { activeConns--; });
  
  console.log("[REQ] " + req.method + " " + req.url);
  try {
    var parsed = new URL(req.url, 'http://localhost');
    var pathname = parsed.pathname;
    var query = Object.fromEntries(parsed.searchParams);

    // 1. Homepage
    if (pathname === '/' || pathname === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': cachedIndex.length, 'Cache-Control': 'public, max-age=60' });
      res.end(cachedIndex);
      return;
    }

    // 2. Static chunks
    if (pathname.startsWith('/_next/static/')) {
      var fp = path.join(__dirname, '.next', 'static', pathname.replace('/_next/static/', ''));
      if (serveFile(fp, res)) return;
      res.writeHead(404); res.end('Not Found');
      return;
    }

    // 3. Public assets
    if (pathname === '/sw.js' || pathname === '/manifest.json' || pathname === '/robots.txt') {
      if (serveFile(path.join(__dirname, 'public', pathname.slice(1)), res, 0)) return;
    }

    if (pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp|json|txt|xml|mp3|wav)$/)) {
      if (serveFile(path.join(__dirname, 'public', pathname.slice(1)), res, 3600)) return;
    }

    // 4. API routes
    if (pathname.startsWith('/api/')) {
      try {
        var result = handleApi(req, res, pathname, query);
        if (result && !res.headersSent) {
          res.writeHead(result.code, result.headers);
          res.end(result.body);
        }
      } catch (e) {
        console.error('[API]', pathname, e.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      return;
    }

    // 5. SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': cachedIndex.length });
    res.end(cachedIndex);
  } catch (e) {
    console.error('[REQ]', e.message);
    if (!res.headersSent) { res.writeHead(500); res.end('Error'); }
  }
});

function json(code, data) {
  var body = JSON.stringify(data);
  return { code: code, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body: body };
}

function handleApi(req, res, pathname, query) {
  // Stub responses - no database, no async, instant responses
  if (pathname === "/api/init") {
    return json(200, { data: { users: [{ id: "demo1", name: "Miran M.", email: "miran@rever.si", avatar: null, bike: "Yamaha MT-07", bio: "Motociklistični navdušenec" }], rides: [], routes: [], defaultUser: { id: "demo1", name: "Miran M.", email: "miran@rever.si", avatar: null, bike: "Yamaha MT-07", bio: "Motociklistični navdušenec" }, needsSeed: true, leaderboard: [{ id: "demo1", name: "Miran M.", totalDistance: 0, totalRides: 0 }] } });
  }
  if (pathname === "/api/notifications") return json(200, { data: [] });
  if (pathname === "/api/weather") return json(200, { data: null });
  if (pathname === "/api/achievements") return json(200, { data: { earned: [], newlyEarned: [] } });
  if (pathname === "/api/sos") return json(200, { data: { ok: true } });
  if (pathname === "/api/seed") return json(200, { data: { seeded: false } });
  if (pathname === "/api/leaderboard") return json(200, { data: [{ id: "demo1", name: "Miran M.", totalDistance: 0, totalRides: 0 }] });
  if (pathname.startsWith("/api/users/")) return json(200, { data: { id: "demo1", name: "Miran M." } });
  if (pathname === "/api/rides") return json(200, { data: [] });
  if (pathname === "/api/routes") return json(200, { data: [] });
  if (pathname === "/api/comments") return json(200, { data: [] });
  if (pathname === "/api/settings") return json(200, { data: {} });
  // Default API response
  return json(200, { data: null });
}

function readBody(req) {
  return new Promise(function(resolve) {
    var b = '';
    req.on('data', function(c) { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', function() { resolve(b); });
  });
}

server.maxConnections = 20;
server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, function() {
  console.log('> MotoTrack on :' + PORT + ' (RSS: ' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB)');
});

// Memory monitor + GC
setInterval(function() {
  var m = process.memoryUsage();
  console.log('[MEM] RSS=' + Math.round(m.rss/1024/1024) + 'MB Heap=' + Math.round(m.heapUsed/1024/1024) + 'MB');
  if (global.gc && m.heapUsed > 80 * 1024 * 1024) {
    global.gc();
    console.log('[GC] Forced, new RSS=' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB');
  }
}, 15000);
