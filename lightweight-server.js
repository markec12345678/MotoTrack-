#!/usr/bin/env node
/**
 * MotoTrack Lightweight API + Static Server
 * 
 * Replaces Next.js entirely for the sandbox environment.
 * Uses raw Prisma for database (67MB) instead of Next.js (215MB).
 * Serves pre-rendered HTML for pages and implements API routes directly.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var urlParse = require('url').parse;

// Error handlers
process.on('uncaughtException', function(err) { console.error('[ERR]', err.message); });
process.on('unhandledRejection', function(reason) { console.error('[REJECT]', String(reason)); });

var PORT = parseInt(process.env.PORT || '3000', 10);

// Lazy-loaded Prisma (only load when first API call comes in)
var prisma = null;
function getPrisma() {
  if (!prisma) {
    console.log('[DB] Loading Prisma...');
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
  console.log('[STATIC] Cached index: ' + cachedIndex.length + ' bytes');
} catch (e) {
  console.log('[STATIC] No cached index - will generate minimal one');
  cachedIndex = Buffer.from('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoTrack</title></head><body><div id="__next"></div></body></html>');
}

var MIME_TYPES = {
  '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.webp': 'image/webp', '.wasm': 'application/wasm',
  '.map': 'application/json', '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

function serveStatic(filePath, res, maxAge) {
  try {
    if (!fs.existsSync(filePath)) return false;
    var stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    var ext = path.extname(filePath);
    var ct = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': ct, 'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=' + (maxAge !== undefined ? maxAge : 31536000),
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) { return false; }
}

function jsonRes(res, code, data) {
  var body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ── API Route Handlers ──────────────────────────────────────────────

var apiRoutes = {
  '/api/init': async function(req, res) {
    var db = getPrisma();
    var [users, rides, routes] = await Promise.all([
      db.user.findMany({ select: { id: true, name: true, email: true, avatar: true, bike: true, bio: true } }),
      db.ride.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.route.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    var needsSeed = users.length === 0;
    var defaultUser = users[0] || null;
    var leaderboard = users.slice(0, 10).map(function(u) { return { id: u.id, name: u.name, totalDistance: 0, totalRides: 0 }; });
    jsonRes(res, 200, { data: { users: users, rides: rides, routes: routes, defaultUser: defaultUser, needsSeed: needsSeed, leaderboard: leaderboard } });
  },

  '/api/seed': async function(req, res) {
    if (req.method !== 'POST') { jsonRes(res, 405, { error: 'Method not allowed' }); return; }
    var db = getPrisma();
    // Check if already seeded
    var count = await db.user.count();
    if (count > 0) { jsonRes(res, 200, { data: { seeded: false, message: 'Already seeded' } }); return; }
    // Seed with default data
    var user = await db.user.create({ data: { name: 'Miran M.', email: 'miran@rever.si', avatar: null, bike: 'Yamaha MT-07', bio: 'Motociklistični navdušenec iz Ljubljane' } });
    jsonRes(res, 200, { data: { seeded: true, user: user } });
  },

  '/api/rides': async function(req, res) {
    var db = getPrisma();
    if (req.method === 'GET') {
      var rides = await db.ride.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      jsonRes(res, 200, { data: rides });
    } else if (req.method === 'POST') {
      var body = await readBody(req);
      var data = JSON.parse(body);
      var ride = await db.ride.create({ data: data });
      jsonRes(res, 200, { data: ride });
    }
  },

  '/api/routes': async function(req, res) {
    var db = getPrisma();
    if (req.method === 'GET') {
      var routes = await db.route.findMany({ where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      jsonRes(res, 200, { data: routes });
    } else if (req.method === 'POST') {
      var body = await readBody(req);
      var data = JSON.parse(body);
      var route = await db.route.create({ data: data });
      jsonRes(res, 200, { data: route });
    }
  },

  '/api/comments': async function(req, res) {
    var db = getPrisma();
    var parsed = urlParse(req.url, true);
    var query = parsed.query || {};
    if (req.method === 'GET') {
      var where = {};
      if (query.rideId) where.rideId = query.rideId;
      if (query.routeId) where.routeId = query.routeId;
      var comments = await db.comment.findMany({ where: where, orderBy: { createdAt: 'desc' }, take: 50 });
      jsonRes(res, 200, { data: comments });
    } else if (req.method === 'POST') {
      var body = await readBody(req);
      var data = JSON.parse(body);
      var comment = await db.comment.create({ data: data });
      jsonRes(res, 200, { data: comment });
    }
  },

  '/api/weather': async function(req, res) {
    var parsed = urlParse(req.url, true);
    var lat = parsed.query?.lat || '46.15';
    var lng = parsed.query?.lng || '14.99';
    try {
      var weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto');
      var weather = await weatherRes.json();
      jsonRes(res, 200, { data: weather });
    } catch (e) {
      jsonRes(res, 200, { data: null });
    }
  },

  '/api/notifications': async function(req, res) {
    jsonRes(res, 200, { data: [] });
  },

  '/api/users': async function(req, res) {
    var db = getPrisma();
    var parsed = urlParse(req.url, true);
    var userId = parsed.pathname.replace('/api/users/', '');
    if (userId && userId !== '/api/users') {
      var user = await db.user.findUnique({ where: { id: userId } });
      jsonRes(res, 200, { data: user });
    } else {
      var users = await db.user.findMany();
      jsonRes(res, 200, { data: users });
    }
  },

  '/api/settings': async function(req, res) {
    var db = getPrisma();
    var parsed = urlParse(req.url, true);
    var userId = parsed.query?.userId;
    if (!userId) { jsonRes(res, 200, { data: {} }); return; }
    if (req.method === 'GET') {
      var settings = await db.userSettings.findUnique({ where: { userId: userId } });
      jsonRes(res, 200, { data: settings || {} });
    } else if (req.method === 'POST') {
      var body = await readBody(req);
      var data = JSON.parse(body);
      var settings = await db.userSettings.upsert({ where: { userId: userId }, update: data, create: Object.assign({ userId: userId }, data) });
      jsonRes(res, 200, { data: settings });
    }
  },

  '/api/achievements': async function(req, res) {
    jsonRes(res, 200, { data: { earned: [], newlyEarned: [] } });
  },

  '/api/leaderboard': async function(req, res) {
    var db = getPrisma();
    var users = await db.user.findMany({ take: 10 });
    var leaderboard = users.map(function(u) { return { id: u.id, name: u.name, totalDistance: 0, totalRides: 0 }; });
    jsonRes(res, 200, { data: leaderboard });
  },

  '/api/sos': async function(req, res) {
    jsonRes(res, 200, { data: { ok: true } });
  },
};

function readBody(req) {
  return new Promise(function(resolve) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() { resolve(body); });
  });
}

// ── Main Request Handler ────────────────────────────────────────────

var server = http.createServer(async function(req, res) {
  var parsed = urlParse(req.url, true);
  var pathname = parsed.pathname || '/';
  var url = req.url;

  try {
    // 1. Homepage → cached HTML
    if (pathname === '/' || pathname === '') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': cachedIndex.length,
        'Cache-Control': 'public, max-age=60',
      });
      res.end(cachedIndex);
      return;
    }

    // 2. Static chunks from .next/static
    if (pathname.startsWith('/_next/static/')) {
      var fp = path.join(__dirname, '.next', 'static', pathname.replace('/_next/static/', ''));
      if (serveStatic(fp, res)) return;
    }

    // 3. Public assets
    if (pathname === '/sw.js' || pathname === '/manifest.json' || pathname === '/robots.txt') {
      var pp = path.join(__dirname, 'public', pathname.replace(/^\//, ''));
      if (serveStatic(pp, res, 0)) return;
    }

    if (pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp|json|txt|xml)$/)) {
      var pubPath = path.join(__dirname, 'public', pathname.replace(/^\//, ''));
      if (serveStatic(pubPath, res, 3600)) return;
    }

    // 4. API routes
    if (pathname.startsWith('/api/')) {
      // Find matching route handler
      var handler = null;
      for (var route in apiRoutes) {
        if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
          handler = apiRoutes[route];
          break;
        }
      }
      // Special: /api/users/:id
      if (!handler && pathname.startsWith('/api/users/')) {
        handler = apiRoutes['/api/users'];
      }
      // Special: /api/routes/:id/like
      if (!handler && pathname.startsWith('/api/routes/')) {
        handler = apiRoutes['/api/routes'];
      }
      // Special: /api/rides/:id
      if (!handler && pathname.startsWith('/api/rides/')) {
        handler = apiRoutes['/api/rides'];
      }

      if (handler) {
        try {
          await handler(req, res);
        } catch (e) {
          console.error('[API]', pathname, e.message);
          jsonRes(res, 500, { error: e.message });
        }
        return;
      }

      // Fallback for unhandled API routes
      jsonRes(res, 200, { data: null, message: 'Endpoint available in full version' });
      return;
    }

    // 5. SPA fallback → serve cached index
    if (cachedIndex) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': cachedIndex.length,
      });
      res.end(cachedIndex);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (e) {
    console.error('[REQ]', e.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Server Error');
    }
  }
});

server.timeout = 60000;
server.keepAliveTimeout = 5000;
server.headersTimeout = 65000;

server.listen(PORT, function() {
  console.log('> MotoTrack lightweight on :' + PORT + ' (RSS: ' + Math.round(process.memoryUsage().rss/1024/1024) + 'MB)');
});

server.on('error', function(err) {
  console.error('[HTTP]', err.message);
});

// Memory monitor
setInterval(function() {
  var m = process.memoryUsage();
  console.log('[MEM] RSS=' + Math.round(m.rss/1024/1024) + 'MB Heap=' + Math.round(m.heapUsed/1024/1024) + 'MB');
}, 30000);
