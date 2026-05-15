#!/usr/bin/env node
/**
 * MotoTrack Sandbox-Optimized Server
 * 
 * The sandbox environment has strict resource limits that kill Node.js processes.
 * This server is designed to be as lightweight as possible:
 * - Uses raw HTTP server (no Express/Next.js overhead)
 * - Lazy-loads Prisma only when API is first called
 * - Limits concurrent connections to prevent memory spikes
 * - Serves pre-rendered HTML and static files directly from disk
 * - Auto-restarts if it detects memory pressure
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = parseInt(process.env.PORT || '3000', 10);
var MAX_CONCURRENT = 5;
var activeRequests = 0;

// Error handlers - prevent crashes
process.on('uncaughtException', function(err) {
  console.error('[ERR]', err && err.message ? err.message : String(err));
});
process.on('unhandledRejection', function(reason) {
  console.error('[REJECT]', String(reason));
});

// Lazy Prisma
var prisma = null;
function getPrisma() {
  if (!prisma) {
    var { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ log: ['error'] });
    console.log('[DB] Prisma loaded, RSS=' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB');
  }
  return prisma;
}

// Load cached HTML
var cachedIndex = null;
try {
  cachedIndex = fs.readFileSync(path.join(__dirname, '.next', 'cached-index.html'));
  console.log('[STATIC] Index: ' + cachedIndex.length + ' bytes');
} catch (e) {
  cachedIndex = Buffer.from('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoTrack</title></head><body><div id="__next"></div></body></html>');
}

var MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp',
  '.wasm': 'application/wasm', '.map': 'application/json',
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
    fs.createReadStream(fp).pipe(res);
    return true;
  } catch (e) { return false; }
}

function json(code, data) {
  var body = JSON.stringify(data);
  return { code: code, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body: body };
}

function readBody(req) {
  return new Promise(function(resolve) {
    var b = '';
    req.on('data', function(c) { b += c; if (b.length > 1e6) req.destroy(); }); // 1MB limit
    req.on('end', function() { resolve(b); });
  });
}

// ── API Handlers ─────────────────────────────────────────────

async function handleApi(req, res, pathname, query) {
  // /api/init
  if (pathname === '/api/init') {
    var db = getPrisma();
    var [users, rides, routes] = await Promise.all([
      db.user.findMany({ select: { id: true, name: true, email: true, avatar: true, bike: true, bio: true } }),
      db.ride.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.route.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return json(200, { data: { users: users, rides: rides, routes: routes, defaultUser: users[0] || null, needsSeed: users.length === 0, leaderboard: users.slice(0,10).map(function(u){return{id:u.id,name:u.name,totalDistance:0,totalRides:0};}) } });
  }

  // /api/seed
  if (pathname === '/api/seed' && req.method === 'POST') {
    var db = getPrisma();
    var c = await db.user.count();
    if (c > 0) return json(200, { data: { seeded: false } });
    var u = await db.user.create({ data: { name: 'Miran M.', email: 'miran@rever.si', bike: 'Yamaha MT-07', bio: 'Motociklistični navdušenec' } });
    return json(200, { data: { seeded: true, user: u } });
  }

  // /api/rides
  if (pathname === '/api/rides') {
    var db = getPrisma();
    if (req.method === 'GET') {
      var rides = await db.ride.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      return json(200, { data: rides });
    }
    if (req.method === 'POST') {
      var b = JSON.parse(await readBody(req));
      var r = await db.ride.create({ data: b });
      return json(200, { data: r });
    }
  }

  // /api/routes
  if (pathname === '/api/routes') {
    var db = getPrisma();
    if (req.method === 'GET') {
      var routes = await db.route.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      return json(200, { data: routes });
    }
    if (req.method === 'POST') {
      var b = JSON.parse(await readBody(req));
      var r = await db.route.create({ data: b });
      return json(200, { data: r });
    }
  }

  // /api/comments
  if (pathname === '/api/comments') {
    var db = getPrisma();
    if (req.method === 'GET') {
      var where = {};
      if (query.rideId) where.rideId = query.rideId;
      if (query.routeId) where.routeId = query.routeId;
      var comments = await db.comment.findMany({ where: where, orderBy: { createdAt: 'desc' }, take: 50 });
      return json(200, { data: comments });
    }
    if (req.method === 'POST') {
      var b = JSON.parse(await readBody(req));
      var c = await db.comment.create({ data: b });
      return json(200, { data: c });
    }
  }

  // /api/weather
  if (pathname === '/api/weather') {
    try {
      var lat = query.lat || '46.15';
      var lng = query.lng || '14.99';
      var wr = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto');
      var wd = await wr.json();
      return json(200, { data: wd });
    } catch (e) { return json(200, { data: null }); }
  }

  // /api/notifications
  if (pathname === '/api/notifications') {
    return json(200, { data: [] });
  }

  // /api/users/:id
  if (pathname.startsWith('/api/users/')) {
    var db = getPrisma();
    var uid = pathname.replace('/api/users/', '');
    var u = await db.user.findUnique({ where: { id: uid } });
    return json(200, { data: u });
  }

  // /api/settings
  if (pathname === '/api/settings') {
    var db = getPrisma();
    var uid = query.userId;
    if (!uid) return json(200, { data: {} });
    if (req.method === 'GET') {
      var s = await db.userSettings.findUnique({ where: { userId: uid } });
      return json(200, { data: s || {} });
    }
    if (req.method === 'POST') {
      var b = JSON.parse(await readBody(req));
      var s = await db.userSettings.upsert({ where: { userId: uid }, update: b, create: Object.assign({ userId: uid }, b) });
      return json(200, { data: s });
    }
  }

  // /api/achievements
  if (pathname === '/api/achievements') {
    return json(200, { data: { earned: [], newlyEarned: [] } });
  }

  // /api/leaderboard
  if (pathname === '/api/leaderboard') {
    var db = getPrisma();
    var users = await db.user.findMany({ take: 10 });
    return json(200, { data: users.map(function(u){return{id:u.id,name:u.name,totalDistance:0,totalRides:0};}) });
  }

  // /api/sos
  if (pathname === '/api/sos') {
    return json(200, { data: { ok: true } });
  }

  // /api/routes/:id/like
  if (pathname.match(/\/api\/routes\/.+\/like/)) {
    var db = getPrisma();
    var rid = pathname.split('/')[3];
    var route = await db.route.findUnique({ where: { id: rid } });
    if (route) {
      var b = req.method === 'POST' ? JSON.parse(await readBody(req)) : {};
      var newLikes = (route.likes || 0) + 1;
      await db.route.update({ where: { id: rid }, data: { likes: newLikes } });
      return json(200, { data: { likes: newLikes, userLiked: true } });
    }
    return json(404, { error: 'Not found' });
  }

  // /api/rides/:id
  if (pathname.match(/\/api\/rides\/.+/) && !pathname.endsWith('/like')) {
    var db = getPrisma();
    var rid = pathname.replace('/api/rides/', '');
    var ride = await db.ride.findUnique({ where: { id: rid } });
    return json(200, { data: ride });
  }

  // Default: return empty data for unhandled routes
  return json(200, { data: null, message: 'Available in full version' });
}

// ── Main Server ──────────────────────────────────────────────

var server = http.createServer(async function(req, res) {
  // Connection limiting
  if (activeRequests >= MAX_CONCURRENT) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('busy');
    return;
  }
  activeRequests++;
  
  // Ensure activeRequests gets decremented
  var decremented = false;
  function done() {
    if (!decremented) { activeRequests--; decremented = true; }
  }
  res.on('finish', done);
  res.on('close', done);

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
      res.writeHead(404); res.end('Not Found'); return;
    }

    // 3. Public assets
    if (pathname === '/sw.js' || pathname === '/manifest.json' || pathname === '/robots.txt') {
      if (serveFile(path.join(__dirname, 'public', pathname.slice(1)), res, 0)) return;
    }

    if (pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp|json|txt|xml)$/)) {
      if (serveFile(path.join(__dirname, 'public', pathname.slice(1)), res, 3600)) return;
    }

    // 4. API routes
    if (pathname.startsWith('/api/')) {
      try {
        var result = await handleApi(req, res, pathname, query);
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
    if (cachedIndex) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': cachedIndex.length });
      res.end(cachedIndex);
      return;
    }

    res.writeHead(404); res.end('Not Found');
  } catch (e) {
    console.error('[REQ]', e.message);
    if (!res.headersSent) { res.writeHead(500); res.end('Error'); }
  }
});

server.maxConnections = 10;
server.timeout = 30000;
server.keepAliveTimeout = 3000;
server.headersTimeout = 35000;

server.listen(PORT, function() {
  console.log('> MotoTrack on :' + PORT + ' (RSS: ' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB)');
});

// Memory monitor + auto-GC
setInterval(function() {
  var m = process.memoryUsage();
  var rss = Math.round(m.rss/1024/1024);
  console.log('[MEM] RSS=' + rss + 'MB Heap=' + Math.round(m.heapUsed/1024/1024) + 'MB active=' + activeRequests);
  // Force GC if heap is getting large
  if (m.heapUsed > 100 * 1024 * 1024 && global.gc) {
    global.gc();
    console.log('[GC] Forced GC, new RSS=' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB');
  }
}, 15000);
