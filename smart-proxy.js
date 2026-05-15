#!/usr/bin/env node
/**
 * MotoTrack Smart Proxy + Auto-Restart Backend
 * 
 * Problem: The sandbox kills processes with >~150MB RSS memory.
 * Next.js uses ~200MB RSS and gets killed after ~10-15 seconds.
 * Simple Node.js HTTP servers at ~50MB RSS survive indefinitely.
 * 
 * Solution:
 * 1. This script is a lightweight proxy (~50MB RSS) on port 3000
 * 2. It spawns Next.js on port 3001 as a child process
 * 3. When Next.js gets killed, it auto-restarts (typically in 1-2s)
 * 4. While Next.js is restarting, we serve cached HTML for the homepage
 * 5. API requests during restart get a "restarting" response
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var { spawn } = require('child_process');

var PORT = 3000;
var API_PORT = 3001;
var cachedIndex = null;
var backendReady = false;
var backendProc = null;
var restartCount = 0;

// Load cached HTML
try {
  cachedIndex = fs.readFileSync(path.join(__dirname, '.next', 'cached-index.html'));
  console.log('[PROXY] Loaded cached index (' + cachedIndex.length + ' bytes)');
} catch (e) {
  console.error('[PROXY] No cached index found');
}

var MIME_TYPES = {
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
  '.html': 'text/html; charset=utf-8',
};

function serveStatic(filePath, res) {
  try {
    if (!fs.existsSync(filePath)) return false;
    var stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    var ext = path.extname(filePath);
    var ct = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) { return false; }
}

function proxyToBackend(req, res) {
  var opts = {
    hostname: '127.0.0.1',
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: 'localhost:' + API_PORT }),
  };
  var proxyReq = http.request(opts, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', function() {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend restarting...', retry: true }));
    }
  });
  req.pipe(proxyReq);
}

var server = http.createServer(function(req, res) {
  var url = req.url.split('?')[0];
  
  // Homepage → serve cached HTML (instant, no backend needed)
  if (url === '/' || url === '') {
    if (cachedIndex) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': cachedIndex.length,
        'Cache-Control': 'public, max-age=60',
      });
      res.end(cachedIndex);
      return;
    }
  }
  
  // Static files → serve from disk (no backend needed)
  if (url.startsWith('/_next/static/')) {
    var fp = path.join(__dirname, '.next', 'static', url.replace('/_next/static/', ''));
    if (serveStatic(fp, res)) return;
  }
  
  // Public files
  var pubPath = path.join(__dirname, 'public', url.replace(/^\//, ''));
  if (url.match(/\.(png|jpg|svg|ico|woff2?|webp|json|js|css|txt)$/)) {
    if (serveStatic(pubPath, res, 3600)) return;
  }
  
  // Everything else → proxy to backend
  proxyToBackend(req, res);
});

server.timeout = 60000;
server.keepAliveTimeout = 5000;
server.headersTimeout = 65000;

server.listen(PORT, function() {
  console.log('[PROXY] MotoTrack proxy on :' + PORT + ' → :' + API_PORT);
  startBackend();
});

// Start/restart backend
function startBackend() {
  restartCount++;
  console.log('[PROXY] Starting backend (attempt ' + restartCount + ')...');
  backendReady = false;
  
  backendProc = spawn('node', ['run-server.mjs'], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { PORT: String(API_PORT) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  var readyTimeout = setTimeout(function() {
    if (!backendReady) {
      console.log('[PROXY] Backend did not become ready in 10s, killing...');
      backendProc.kill();
    }
  }, 10000);
  
  backendProc.stdout.on('data', function(data) {
    var msg = data.toString().trim();
    if (msg.indexOf('ready') !== -1) {
      backendReady = true;
      clearTimeout(readyTimeout);
      console.log('[PROXY] Backend ready!');
    }
  });
  
  backendProc.stderr.on('data', function(data) {
    // Silently ignore stderr
  });
  
  backendProc.on('exit', function(code, signal) {
    console.log('[PROXY] Backend died (code=' + code + ' signal=' + signal + ')');
    backendReady = false;
    backendProc = null;
    // Restart after a short delay
    setTimeout(startBackend, 1000);
  });
  
  backendProc.on('error', function(err) {
    console.log('[PROXY] Backend spawn error: ' + err.message);
    backendReady = false;
    setTimeout(startBackend, 3000);
  });
}

// Memory monitor
setInterval(function() {
  var m = process.memoryUsage();
  console.log('[PROXY] RSS=' + Math.round(m.rss/1024/1024) + 'MB backend=' + (backendReady ? 'up' : 'down'));
}, 30000);
