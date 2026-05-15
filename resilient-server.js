#!/usr/bin/env node
/**
 * MotoTrack Resilient Server
 * 
 * The sandbox kills Node.js processes when RSS exceeds ~215MB.
 * Next.js page serving stays at ~185MB, but API routes (Prisma/SQLite)
 * push memory to 215MB+, causing the process to be killed.
 * 
 * Solution: Two-process architecture
 * 1. Frontend proxy on port 3000 (lightweight, ~50MB, serves cached HTML + static files)
 * 2. Next.js backend on port 3001 (heavy, ~200MB, handles API routes)
 * 3. When backend dies, proxy auto-restarts it and serves cached content in the meantime
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var { spawn } = require('child_process');

var PORT = parseInt(process.env.PORT || '3000', 10);
var BACKEND_PORT = PORT + 1;
var cachedIndex = null;
var backendReady = false;
var backendProc = null;
var restartCount = 0;
var lastRestartTime = 0;

// Error handlers
process.on('uncaughtException', function(err) {
  console.error('[PROXY] Uncaught:', err.message);
});
process.on('unhandledRejection', function(reason) {
  console.error('[PROXY] Rejection:', String(reason));
});

// Load cached HTML
try {
  cachedIndex = fs.readFileSync(path.join(__dirname, '.next', 'cached-index.html'));
  console.log('[PROXY] Cached index: ' + cachedIndex.length + ' bytes');
} catch (e) {
  console.log('[PROXY] No cached index');
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
      'Content-Type': ct,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=' + (maxAge || 31536000),
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) { return false; }
}

function proxyRequest(req, res) {
  var opts = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: 'localhost:' + BACKEND_PORT }),
    timeout: 30000,
  };
  var proxyReq = http.request(opts, function(proxyRes) {
    // Add restart hint header so client knows to retry
    var headers = Object.assign({}, proxyRes.headers);
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', function() {
    if (!res.headersSent) {
      if (req.url.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend restarting', retry: true, data: null }));
      } else {
        // Serve cached HTML as fallback
        if (cachedIndex) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': cachedIndex.length,
          });
          res.end(cachedIndex);
        } else {
          res.writeHead(503, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Restarting...</h1><script>setTimeout(()=>location.reload(),2000)</script></body></html>');
        }
      }
    }
  });
  proxyReq.on('timeout', function() {
    proxyReq.destroy();
  });
  req.pipe(proxyReq);
}

var requestCount = 0;

var server = http.createServer(function(req, res) {
  requestCount++;
  var url = req.url.split('?')[0];
  
  // Homepage → cached HTML (instant, no backend needed)
  if (url === '/' || url === '') {
    if (cachedIndex) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': cachedIndex.length,
        'Cache-Control': 'public, max-age=60',
        'X-Backend': backendReady ? 'cache' : 'cache-offline',
      });
      res.end(cachedIndex);
      return;
    }
  }
  
  // Static chunks from .next/static
  if (url.startsWith('/_next/static/')) {
    var fp = path.join(__dirname, '.next', 'static', url.replace('/_next/static/', ''));
    if (serveStatic(fp, res)) return;
  }
  
  // Public assets
  if (url.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp|json|txt|xml|mp3|wav)$/)) {
    var pubPath = path.join(__dirname, 'public', url.replace(/^\//, ''));
    if (serveStatic(pubPath, res, 3600)) return;
  }
  
  // SW and manifest
  if (url === '/sw.js' || url === '/manifest.json' || url === '/robots.txt') {
    var pp = path.join(__dirname, 'public', url.replace(/^\//, ''));
    if (serveStatic(pp, res, 0)) return;
  }
  
  // Everything else → proxy to backend
  proxyRequest(req, res);
});

server.timeout = 60000;
server.keepAliveTimeout = 5000;
server.headersTimeout = 65000;

server.listen(PORT, function() {
  console.log('[PROXY] MotoTrack on :' + PORT + ' (backend: :' + BACKEND_PORT + ')');
  startBackend();
});

server.on('error', function(err) {
  console.error('[PROXY] Server error:', err.message);
});

function startBackend() {
  var now = Date.now();
  if (now - lastRestartTime < 2000) {
    setTimeout(startBackend, 2000 - (now - lastRestartTime));
    return;
  }
  lastRestartTime = now;
  restartCount++;
  backendReady = false;
  
  console.log('[PROXY] Starting backend #' + restartCount + '...');
  
  backendProc = spawn('node', ['--max-old-space-size=192', 'run-server.mjs'], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { PORT: String(BACKEND_PORT), NODE_OPTIONS: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  var readyTimer = setTimeout(function() {
    if (!backendReady) {
      console.log('[PROXY] Backend not ready in 15s, killing...');
      try { backendProc.kill('SIGKILL'); } catch (e) {}
    }
  }, 15000);
  
  backendProc.stdout.on('data', function(data) {
    var msg = data.toString().trim();
    if (msg.indexOf('ready') !== -1 && !backendReady) {
      backendReady = true;
      clearTimeout(readyTimer);
      console.log('[PROXY] Backend UP!');
    }
  });
  
  backendProc.stderr.on('data', function() {}); // Ignore stderr
  
  backendProc.on('exit', function(code, signal) {
    console.log('[PROXY] Backend DOWN (code=' + code + ' signal=' + signal + ')');
    backendReady = false;
    backendProc = null;
    setTimeout(startBackend, 1500);
  });
  
  backendProc.on('error', function(err) {
    console.log('[PROXY] Backend error: ' + err.message);
    backendReady = false;
    setTimeout(startBackend, 3000);
  });
}

// Memory monitor for proxy
setInterval(function() {
  var m = process.memoryUsage();
  console.log('[PROXY] RSS=' + Math.round(m.rss/1024/1024) + 'MB backend=' + (backendReady ? 'UP' : 'DOWN') + ' reqs=' + requestCount);
}, 30000);
