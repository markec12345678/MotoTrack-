#!/usr/bin/env node
/**
 * MotoTrack Ultra-Lightweight Server
 * 
 * Strategy: Do NOT load Next.js at all. Instead:
 * 1. Serve pre-rendered HTML from .next/server for pages
 * 2. Serve static files from .next/static and public/
 * 3. Spawn Next.js as a CHILD PROCESS on a different port for API routes only
 * 4. Proxy /api/* requests to the child process
 * 
 * This keeps the main server lightweight and stable.
 */

var http = require('http');
var urlParse = require('url').parse;
var fs = require('fs');
var path = require('path');
var { execSync, spawn } = require('child_process');

var PORT = 3000;
var API_PORT = 3001; // Next.js runs internally on this port

var MIME_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Error handlers
process.on('uncaughtException', function(err) {
  console.error('[UNCAUGHT]', err && err.message ? err.message : String(err));
});
process.on('unhandledRejection', function(reason) {
  console.error('[REJECTION]', String(reason));
});

var prerenderedHtml = null;
var apiServerReady = false;
var apiServerProc = null;

// Load pre-rendered HTML
function loadPrerendered() {
  try {
    // Try cached-index.html first
    var indexPath = path.join(process.cwd(), '.next', 'cached-index.html');
    if (fs.existsSync(indexPath)) {
      prerenderedHtml = fs.readFileSync(indexPath);
      console.log('[STATIC] Loaded cached-index.html (' + prerenderedHtml.length + ' bytes)');
      return;
    }
    // Try .next/server/app/index.html (Next.js production output)
    var serverPath = path.join(process.cwd(), '.next', 'server', 'app', 'index.html');
    if (fs.existsSync(serverPath)) {
      prerenderedHtml = fs.readFileSync(serverPath);
      console.log('[STATIC] Loaded server/app/index.html (' + prerenderedHtml.length + ' bytes)');
      return;
    }
    // Try .next/server/pages/index.html
    var pagesPath = path.join(process.cwd(), '.next', 'server', 'pages', 'index.html');
    if (fs.existsSync(pagesPath)) {
      prerenderedHtml = fs.readFileSync(pagesPath);
      console.log('[STATIC] Loaded server/pages/index.html (' + prerenderedHtml.length + ' bytes)');
      return;
    }
    console.log('[STATIC] No pre-rendered HTML found, will use fallback');
  } catch (e) {
    console.error('[STATIC] Error loading HTML:', e.message);
  }
}

function serveStaticFile(filePath, res, cacheMaxAge) {
  try {
    if (!fs.existsSync(filePath)) return false;
    var stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    var ext = path.extname(filePath);
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';
    var headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
    };
    if (cacheMaxAge !== undefined) {
      headers['Cache-Control'] = 'public, max-age=' + cacheMaxAge;
    } else {
      // Default: immutable for hashed static files
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) {
    return false;
  }
}

function proxyRequest(req, res, targetPort) {
  var parsedUrl = urlParse(req.url, true);
  var options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, {
      'host': 'localhost:' + targetPort,
    }),
  };
  
  var proxyReq = http.request(options, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', function(err) {
    console.error('[PROXY-ERR]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, {'Content-Type': 'text/plain'});
      res.end('Backend unavailable');
    }
  });
  
  req.pipe(proxyReq);
}

function handleRequest(req, res) {
  var parsedUrl = urlParse(req.url, true);
  var pathname = parsedUrl.pathname || '/';
  
  // 1. API routes → proxy to Next.js child process
  if (pathname.startsWith('/api/')) {
    if (!apiServerReady) {
      res.writeHead(503, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Server starting...' }));
      return;
    }
    proxyRequest(req, res, API_PORT);
    return;
  }
  
  // 2. Homepage → serve pre-rendered HTML
  if (pathname === '/' || pathname === '') {
    if (prerenderedHtml) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(prerenderedHtml),
        'Cache-Control': 'public, max-age=60',
      });
      res.end(prerenderedHtml);
      return;
    }
    // Fallback
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoTrack</title></head><body><div id="__next"></div><script>setTimeout(()=>location.reload(),3000)</script></body></html>');
    return;
  }
  
  // 3. Static chunks from .next/static/
  if (pathname.startsWith('/_next/static/')) {
    var staticPath = path.join(process.cwd(), '.next', 'static', pathname.replace('/_next/static/', ''));
    if (serveStaticFile(staticPath, res)) return;
    // Try without query hash in filename
    var cleanPath = staticPath.split('?')[0];
    if (cleanPath !== staticPath && serveStaticFile(cleanPath, res)) return;
  }
  
  // 4. _next/data routes → proxy to Next.js
  if (pathname.startsWith('/_next/data/') || pathname.startsWith('/_next/image')) {
    if (apiServerReady) {
      proxyRequest(req, res, API_PORT);
      return;
    }
    res.writeHead(503, {'Content-Type': 'text/plain'});
    res.end('Not ready');
    return;
  }
  
  // 5. Other _next routes
  if (pathname.startsWith('/_next/')) {
    // Try serving from .next directory
    var nextPath = path.join(process.cwd(), pathname);
    if (serveStaticFile(nextPath, res)) return;
    // Proxy as fallback
    if (apiServerReady) {
      proxyRequest(req, res, API_PORT);
      return;
    }
  }
  
  // 6. Public files
  var pubPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
  if (serveStaticFile(pubPath, res, 3600)) return;
  
  // 7. SPA fallback → serve index.html for any unknown route
  if (prerenderedHtml) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(prerenderedHtml),
    });
    res.end(prerenderedHtml);
    return;
  }
  
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found');
}

// Start Next.js as a child process for API routes
function startApiServer() {
  console.log('[API] Starting Next.js on internal port ' + API_PORT + '...');
  
  apiServerProc = spawn('node', ['run-server.mjs'], {
    cwd: process.cwd(),
    env: Object.assign({}, process.env, { PORT: String(API_PORT) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  apiServerProc.stdout.on('data', function(data) {
    var msg = data.toString().trim();
    console.log('[API-OUT]', msg);
    if (msg.indexOf('ready') !== -1 || msg.indexOf('Ready') !== -1) {
      apiServerReady = true;
      console.log('[API] Backend ready!');
    }
  });
  
  apiServerProc.stderr.on('data', function(data) {
    console.error('[API-ERR]', data.toString().trim());
  });
  
  apiServerProc.on('exit', function(code, signal) {
    console.error('[API] Process exited with code=' + code + ' signal=' + signal);
    apiServerReady = false;
    // Restart after delay
    setTimeout(function() {
      console.log('[API] Restarting backend...');
      startApiServer();
    }, 3000);
  });
  
  apiServerProc.on('error', function(err) {
    console.error('[API] Failed to start:', err.message);
    apiServerReady = false;
    setTimeout(startApiServer, 5000);
  });
}

// Main
function main() {
  loadPrerendered();
  
  var server = http.createServer(handleRequest);
  server.timeout = 60000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 65000;
  
  server.on('error', function(err) {
    console.error('[HTTP-ERR]', err.message);
  });
  
  server.listen(PORT, function() {
    console.log('> MotoTrack frontend on :' + PORT);
  });
  
  // Start API backend
  startApiServer();
  
  // Memory monitor
  setInterval(function() {
    var mem = process.memoryUsage();
    console.log('[MEM] Main RSS=' + Math.round(mem.rss/1024/1024) + 'MB');
  }, 30000);
}

main();
