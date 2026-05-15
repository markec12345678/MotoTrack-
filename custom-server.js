#!/usr/bin/env node
/**
 * Ultra-resilient MotoTrack server for resource-constrained sandbox
 */

// Global error handlers - MUST be first
var crashCount = 0;
var CRASH_LIMIT = 5;
var CRASH_WINDOW = 60000;
var crashTimes = [];

process.on('uncaughtException', function(err) {
  console.error('[UNCAUGHT]', err && err.message ? err.message : String(err));
  var now = Date.now();
  crashTimes.push(now);
  crashTimes = crashTimes.filter(function(t) { return now - t < CRASH_WINDOW; });
  if (crashTimes.length >= CRASH_LIMIT) {
    console.error('[FATAL] Too many crashes, exiting for restart');
    process.exit(1);
  }
});

process.on('unhandledRejection', function(reason) {
  console.error('[REJECTION]', String(reason));
});

process.on('exit', function(code) {
  console.error('[EXIT] code=' + code + ' at=' + new Date().toISOString());
});

process.on('SIGTERM', function() {
  console.log('[SIGTERM] Graceful shutdown');
  process.exit(0);
});

process.on('SIGINT', function() {
  console.log('[SIGINT] Graceful shutdown');  
  process.exit(0);
});

var http = require('http');
var urlParse = require('url').parse;
var fs = require('fs');
var path = require('path');

var port = parseInt(process.env.PORT || '3000', 10);
var MAX_CONCURRENT = 1;
var REQUEST_TIMEOUT = 30000;

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
};

var activeRequests = 0;
var nextApp = null;
var nextHandle = null;
var isReady = false;

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

async function initNext() {
  try {
    var next = require('next');
    nextApp = next({ dev: false });
    nextHandle = nextApp.getRequestHandler();
    await nextApp.prepare();
    isReady = true;
    var mem = process.memoryUsage();
    console.log('> MotoTrack ready on :' + port + ' (concurrent: ' + MAX_CONCURRENT + ', RSS: ' + Math.round(mem.rss/1024/1024) + 'MB)');
  } catch (err) {
    console.error('[FATAL] Next.js init failed:', err);
    process.exit(1);
  }
}

function handleNextRequest(req, res) {
  var cleaned = false;
  
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    activeRequests = Math.max(0, activeRequests - 1);
  }
  
  req.setTimeout(REQUEST_TIMEOUT);
  res.setTimeout(REQUEST_TIMEOUT);
  
  res.on('finish', cleanup);
  res.on('close', cleanup);
  req.on('close', cleanup);
  
  try {
    var parsedUrl = urlParse(req.url, true);
    nextHandle(req, res, parsedUrl).catch(function(err) {
      console.error('[ERR]', err && err.message ? err.message : String(err));
      cleanup();
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Server Error');
      }
    });
  } catch (err) {
    console.error('[ERR-SYNC]', err && err.message ? err.message : String(err));
    cleanup();
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Server Error');
    }
  }
}

function handleRequest(req, res) {
  try {
    var parsedUrl = urlParse(req.url, true);
    var pathname = parsedUrl.pathname || '/';
    
    // Serve static files directly from disk
    if (pathname.startsWith('/_next/static/')) {
      var filePath = path.join(process.cwd(), '.next', 'static', pathname.replace('/_next/static/', ''));
      if (serveStaticFile(filePath, res)) return;
    }
    
    // Serve public files directly
    if (pathname.startsWith('/icon-') || pathname.startsWith('/logo') || 
        pathname === '/manifest.json' || pathname === '/robots.txt' ||
        pathname === '/sw.js' || pathname.startsWith('/screenshots/')) {
      var pubPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
      if (serveStaticFile(pubPath, res)) return;
    }
    
    // Image/font files from public
    if (pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)) {
      var assetPath = path.join(process.cwd(), 'public', pathname.replace(/^\//, ''));
      if (serveStaticFile(assetPath, res)) return;
    }
    
    if (!isReady) {
      res.writeHead(503, {'Content-Type': 'text/plain'});
      res.end('Server starting...');
      return;
    }
    
    if (activeRequests >= MAX_CONCURRENT) {
      res.writeHead(503, {'Content-Type': 'text/plain', 'Retry-After': '2'});
      res.end('Server busy');
      return;
    }
    
    activeRequests++;
    handleNextRequest(req, res);
  } catch (err) {
    console.error('[ERR-ROUTE]', err && err.message ? err.message : String(err));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Error');
    }
  }
}

async function main() {
  await initNext();
  
  var server = http.createServer(handleRequest);
  
  server.timeout = 60000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 65000;
  server.requestTimeout = 60000;
  
  server.on('error', function(err) {
    console.error('[HTTP-ERR]', err && err.message ? err.message : String(err));
  });
  
  server.on('clientError', function(err, socket) {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });
  
  server.listen(port, 8, function() {
    console.log('> Listening on :' + port);
  });
  
  // Memory monitor
  setInterval(function() {
    var mem = process.memoryUsage();
    console.log('[MEM] RSS=' + Math.round(mem.rss/1024/1024) + 'MB Heap=' + Math.round(mem.heapUsed/1024/1024) + '/' + Math.round(mem.heapTotal/1024/1024) + 'MB Active=' + activeRequests);
  }, 30000);
}

main().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(1);
});
