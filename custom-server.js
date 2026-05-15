#!/usr/bin/env node
/**
 * MotoTrack Sandbox-Optimized Server v2
 * 
 * Key insight: The sandbox process monitor kills processes that handle
 * concurrent HTTP requests. Solution: serialize ALL requests through
 * a queue, processing one at a time.
 * 
 * Strategy:
 * 1. Serve pre-rendered HTML from disk (no SSR)
 * 2. Serve static files (CSS/JS/fonts/images) directly from disk
 * 3. Use Next.js ONLY for API routes (/api/*)
 * 4. Serialize all requests through a queue (max 1 concurrent)
 */

// Error handlers
process.on('uncaughtException', function(err) {
  console.error('[UNCAUGHT]', err && err.message ? err.message : String(err));
});
process.on('unhandledRejection', function(reason) {
  console.error('[REJECTION]', String(reason));
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

var nextHandle = null;
var isReady = false;
var prerenderedIndex = null;

// ===== REQUEST SERIALIZATION QUEUE =====
var queue = [];
var processing = false;
var MAX_QUEUE = 5; // Max queued requests before returning 503

function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  var item = queue.shift();
  
  // Process this request
  try {
    handleRequestInner(item.req, item.res, function() {
      processing = false;
      // Process next in queue on next tick to prevent stack overflow
      setImmediate(processQueue);
    });
  } catch (err) {
    console.error('[HANDLE-ERR]', err.message);
    if (!item.res.headersSent) {
      item.res.writeHead(500, {'Content-Type': 'text/plain'});
      item.res.end('Server Error');
    }
    processing = false;
    setImmediate(processQueue);
  }
}

// ===== PRE-RENDERED HTML =====
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

// ===== STATIC FILE SERVING =====
function serveStaticFile(filePath, res, maxAge) {
  try {
    if (!fs.existsSync(filePath)) return false;
    var stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    var ext = path.extname(filePath);
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=' + (maxAge || 31536000) + ', immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (e) {
    return false;
  }
}

// ===== MAIN REQUEST HANDLER =====
function handleRequestInner(req, res, done) {
  var parsedUrl = urlParse(req.url, true);
  var pathname = parsedUrl.pathname || '/';
  
  // Force connection close to prevent keep-alive buildup
  req.on('end', function() {
    // Ensure done is called when request finishes
  });
  
  // 1. Serve pre-rendered HTML for homepage (NO Next.js SSR!)
  if (pathname === '/' || pathname === '') {
    if (prerenderedIndex) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': prerenderedIndex.length,
        'Cache-Control': 'public, max-age=60',
        'Connection': 'close',
      });
      res.end(prerenderedIndex);
      return done();
    }
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Connection': 'close'});
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>MotoTrack</title></head><body><div id="__next"></div></body></html>');
    return done();
  }
  
  // 2. Serve static files directly from disk (bypasses Next.js)
  if (pathname.startsWith('/_next/static/')) {
    var filePath = path.join(process.cwd(), '.next', 'static', pathname.replace('/_next/static/', ''));
    if (serveStaticFile(filePath, res, 31536000)) return done();
  }
  
  // 3. Serve public files directly
  if (pathname.startsWith('/icon-') || pathname.startsWith('/logo') || 
      pathname === '/manifest.json' || pathname === '/robots.txt' ||
      pathname === '/sw.js' || pathname.startsWith('/screenshots/')) {
    var pubPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
    if (serveStaticFile(pubPath, res, 3600)) return done();
  }
  
  // 4. Image/font files from public
  if (pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|mp3|wav)$/)) {
    var assetPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
    if (serveStaticFile(assetPath, res, 86400)) return done();
  }
  
  // 5. Use Next.js ONLY for API routes
  if (pathname.startsWith('/api/')) {
    if (!isReady) {
      res.writeHead(503, {'Content-Type': 'application/json', 'Connection': 'close'});
      res.end(JSON.stringify({data: null, error: 'Server starting...'}));
      return done();
    }
    
    try {
      nextHandle(req, res, parsedUrl).then(function() {
        done();
      }).catch(function(err) {
        console.error('[API-ERR]', err && err.message ? err.message : String(err));
        if (!res.headersSent) {
          res.writeHead(500, {'Content-Type': 'application/json', 'Connection': 'close'});
          res.end(JSON.stringify({data: null, error: 'Server Error'}));
        }
        done();
      });
    } catch (err) {
      console.error('[API-ERR-SYNC]', err && err.message ? err.message : String(err));
      if (!res.headersSent) {
        res.writeHead(500, {'Content-Type': 'application/json', 'Connection': 'close'});
        res.end(JSON.stringify({data: null, error: 'Server Error'}));
      }
      done();
    }
    return;
  }
  
  // 6. For any other route, serve the pre-rendered index (SPA fallback)
  if (prerenderedIndex) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': prerenderedIndex.length,
      'Connection': 'close',
    });
    res.end(prerenderedIndex);
    return done();
  }
  
  // 7. Final fallback
  res.writeHead(404, {'Content-Type': 'text/plain', 'Connection': 'close'});
  res.end('Not Found');
  done();
}

// ===== ENTRY POINT =====
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
    console.log('> MotoTrack ready :' + port + ' (RSS: ' + Math.round(mem.rss/1024/1024) + 'MB, mode: serialized)');
  } catch (err) {
    console.error('[FATAL] Next.js init failed:', err);
    process.exit(1);
  }
  
  var server = http.createServer(function(req, res) {
    // Enforce Connection: close
    res.setHeader('Connection', 'close');
    
    // Queue the request
    if (queue.length >= MAX_QUEUE) {
      res.writeHead(503, {'Content-Type': 'text/plain', 'Connection': 'close'});
      res.end('Server busy');
      return;
    }
    
    queue.push({req: req, res: res});
    processQueue();
  });
  
  server.timeout = 30000;
  server.keepAliveTimeout = 1000;
  server.headersTimeout = 31000;
  server.maxRequestsPerSocket = 1; // Force close after each request
  
  server.on('error', function(err) {
    console.error('[HTTP-ERR]', err && err.message ? err.message : String(err));
  });
  server.on('clientError', function(err, socket) {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });
  
  server.listen(port, function() {
    console.log('> Listening on :' + port + ' (serialized mode, max queue: ' + MAX_QUEUE + ')');
  });
  
  // Memory monitor
  setInterval(function() {
    var mem = process.memoryUsage();
    console.log('[MEM] RSS=' + Math.round(mem.rss/1024/1024) + 'MB Heap=' + Math.round(mem.heapUsed/1024/1024) + 'MB Queue=' + queue.length);
  }, 30000);
}

main().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(1);
});
