#!/usr/bin/env node
/**
 * MotoTrack Sandbox-Optimized Server
 * 
 * Key insight: Next.js SSR (rendering HTML pages) causes the process
 * to be killed by the sandbox's process monitor. But Next.js API routes
 * work perfectly fine with many concurrent requests.
 * 
 * Strategy:
 * 1. Serve pre-rendered HTML from disk for the homepage (no SSR needed)
 * 2. Serve static files (CSS/JS/fonts/images) directly from disk
 * 3. Use Next.js ONLY for API routes (/api/*) and Next.js data routes (_next/data/*)
 * 4. This keeps memory usage stable and prevents crashes
 */

// Error handlers
process.on('uncaughtException', function(err) {
  console.error('[UNCAUGHT]', err && err.message ? err.message : String(err));
});
process.on('unhandledRejection', function(reason) {
  console.error('[REJECTION]', String(reason));
});
process.on('exit', function(code) {
  console.error('[EXIT] code=' + code);
});

var http = require('http');
var urlParse = require('url').parse;
var fs = require('fs');
var path = require('path');

var port = parseInt(process.env.PORT || '3000', 10);

var MIME_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
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
};

var nextHandle = null;
var isReady = false;
var prerenderedIndex = null;

// Load pre-rendered HTML from disk
function loadPrerendered() {
  try {
    var indexPath = path.join(process.cwd(), '.next', 'cached-index.html');
    if (fs.existsSync(indexPath)) {
      prerenderedIndex = fs.readFileSync(indexPath);
      console.log('[PRE-CACHE] Loaded index.html (' + prerenderedIndex.length + ' bytes)');
    }
  } catch (e) {
    console.error('[PRE-CACHE] Error:', e.message);
  }
}

function serveStaticFile(filePath, res) {
  try {
    if (!fs.existsSync(filePath)) return false;
    var stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    var ext = path.extname(filePath);
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) {
    return false;
  }
}

function handleRequest(req, res) {
  var parsedUrl = urlParse(req.url, true);
  var pathname = parsedUrl.pathname || '/';
  
  // 1. Serve pre-rendered HTML for homepage (NO Next.js SSR!)
  if (pathname === '/' || pathname === '') {
    if (prerenderedIndex) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': prerenderedIndex.length,
        'Cache-Control': 'public, max-age=60',
      });
      res.end(prerenderedIndex);
      return;
    }
    // Fallback: simple loading page if no pre-rendered HTML
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>MotoTrack</title></head><body><div id="__next"></div></body></html>');
    return;
  }
  
  // 2. Serve static files directly from disk (bypasses Next.js)
  if (pathname.startsWith('/_next/static/')) {
    var filePath = path.join(process.cwd(), '.next', 'static', pathname.replace('/_next/static/', ''));
    if (serveStaticFile(filePath, res)) return;
  }
  
  // 3. Serve public files directly
  if (pathname.startsWith('/icon-') || pathname.startsWith('/logo') || 
      pathname === '/manifest.json' || pathname === '/robots.txt' ||
      pathname === '/sw.js' || pathname.startsWith('/screenshots/')) {
    var pubPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
    if (serveStaticFile(pubPath, res)) return;
  }
  
  // 4. Image/font files from public
  if (pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)) {
    var assetPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
    if (serveStaticFile(assetPath, res)) return;
  }
  
  // 5. Use Next.js ONLY for API routes and _next/data routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/data/') || pathname.startsWith('/_next/image')) {
    if (!isReady) {
      res.writeHead(503, {'Content-Type': 'text/plain'});
      res.end('Server starting...');
      return;
    }
    
    try {
      nextHandle(req, res, parsedUrl).catch(function(err) {
        console.error('[API-ERR]', err && err.message ? err.message : String(err));
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Server Error');
        }
      });
    } catch (err) {
      console.error('[API-ERR-SYNC]', err && err.message ? err.message : String(err));
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Server Error');
      }
    }
    return;
  }
  
  // 6. For any other route, serve the pre-rendered index (SPA fallback)
  if (prerenderedIndex) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': prerenderedIndex.length,
    });
    res.end(prerenderedIndex);
    return;
  }
  
  // 7. Final fallback
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found');
}

async function main() {
  loadPrerendered();
  
  // Initialize Next.js for API routes only
  try {
    var next = require('next');
    var app = next({ dev: false });
    nextHandle = app.getRequestHandler();
    await app.prepare();
    isReady = true;
    var mem = process.memoryUsage();
    console.log('> MotoTrack ready :' + port + ' (RSS: ' + Math.round(mem.rss/1024/1024) + 'MB, mode: API-only)');
  } catch (err) {
    console.error('[FATAL] Next.js init failed:', err);
    process.exit(1);
  }
  
  var server = http.createServer(handleRequest);
  server.timeout = 60000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 65000;
  
  server.on('error', function(err) {
    console.error('[HTTP-ERR]', err && err.message ? err.message : String(err));
  });
  server.on('clientError', function(err, socket) {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
  
  server.listen(port, function() {
    console.log('> Listening on :' + port);
  });
  
  // Memory monitor
  setInterval(function() {
    var mem = process.memoryUsage();
    console.log('[MEM] RSS=' + Math.round(mem.rss/1024/1024) + 'MB Heap=' + Math.round(mem.heapUsed/1024/1024) + 'MB');
  }, 30000);
}

main().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(1);
});
