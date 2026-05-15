#!/usr/bin/env node
/**
 * Custom Next.js server with static file serving and concurrency control
 * Serves static files directly from disk (bypassing Next.js for assets)
 * Only uses Next.js for HTML pages and API routes
 * 
 * CRITICAL: This server must survive in a resource-constrained sandbox.
 * All errors are caught to prevent crashes.
 */

// Set up global error handlers FIRST, before any other module loads
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err?.message || err);
  // DON'T exit - try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  // DON'T exit - try to recover  
});

process.on('warning', (warning) => {
  if (warning?.name === 'MaxListenersExceededWarning') {
    console.warn('[WARN] MaxListenersExceeded - some event leak');
  }
});

const { createServer } = require('http');
const { parse } = require('url');
const { existsSync, statSync, createReadStream } = require('fs');
const { join, extname } = require('path');
const next = require('next');

const dev = false;
const port = parseInt(process.env.PORT || '3000', 10);
const MAX_CONCURRENT = 8;

// MIME types for static files
const MIME_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

let activeRequests = 0;
const queue = [];
let app, handle;

function processQueue() {
  while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const { req, res } = queue.shift();
    activeRequests++;
    handleNextRequest(req, res);
  }
}

function serveStaticFile(filePath, res) {
  try {
    if (!existsSync(filePath)) return false;
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Error reading file');
      }
    });
    stream.pipe(res);
    return true;
  } catch (e) {
    return false;
  }
}

function handleNextRequest(req, res) {
  let cleaned = false;
  
  const cleanup = () => {
    if (cleaned) return; // prevent double cleanup
    cleaned = true;
    activeRequests = Math.max(0, activeRequests - 1);
    processQueue();
  };
  
  res.on('finish', cleanup);
  res.on('close', cleanup);
  req.on('close', cleanup);
  
  try {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl).catch((err) => {
      console.error('[ERR] Request handler error:', err?.message || err);
      cleanup();
      if (!res.headersSent) {
        try {
          res.statusCode = 500;
          res.end('Internal Server Error');
        } catch (e) { /* ignore */ }
      }
    });
  } catch (err) {
    console.error('[ERR] Sync error in handler:', err?.message || err);
    cleanup();
    if (!res.headersSent) {
      try {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } catch (e) { /* ignore */ }
    }
  }
}

// Initialize Next.js
try {
  app = next({ dev });
  handle = app.getRequestHandler();
} catch (err) {
  console.error('[FATAL] Failed to initialize Next.js:', err);
  process.exit(1);
}

app.prepare().then(() => {
  console.log(`> MotoTrack server starting on port ${port}...`);
  
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const pathname = parsedUrl.pathname || '/';
      
      // Serve static files directly from disk (bypasses Next.js entirely)
      if (pathname.startsWith('/_next/static/')) {
        const filePath = join(process.cwd(), '.next', 'static', pathname.replace('/_next/static/', ''));
        if (serveStaticFile(filePath, res)) return;
      }
      
      // Serve public files directly (favicon, icons, manifest, etc.)
      if (pathname.startsWith('/icon-') || pathname.startsWith('/logo') || 
          pathname === '/manifest.json' || pathname === '/robots.txt' ||
          pathname === '/sw.js' || pathname.startsWith('/screenshots/') ||
          pathname.endsWith('.png') || pathname.endsWith('.jpg') || 
          pathname.endsWith('.svg') || pathname.endsWith('.webp')) {
        const filePath = join(process.cwd(), 'public', pathname.replace(/^\//, ''));
        if (serveStaticFile(filePath, res)) return;
      }
      
      // For HTML pages and API routes, use Next.js with concurrency control
      if (activeRequests >= MAX_CONCURRENT) {
        // Reject overloaded requests with 503 instead of queuing
        // (queuing stale connections causes crashes)
        res.writeHead(503, { 'Content-Type': 'text/plain', 'Retry-After': '2' });
        res.end('Server busy - retry in 2s');
      } else {
        activeRequests++;
        handleNextRequest(req, res);
      }
    } catch (err) {
      console.error('[ERR] Request routing error:', err?.message || err);
      if (!res.headersSent) {
        try {
          res.statusCode = 500;
          res.end('Server Error');
        } catch (e) { /* ignore */ }
      }
    }
  });
  
  // Increase timeouts
  server.timeout = 60000;
  server.keepAliveTimeout = 10000;
  server.headersTimeout = 65000;
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('[ERR] HTTP server error:', err?.message || err);
    // Don't crash on server errors (e.g., ECONNRESET)
  });
  
  // Handle client errors (malformed requests, etc.)
  server.on('clientError', (err, socket) => {
    console.error('[ERR] Client error:', err?.message || err);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });
  
  // Limit connection backlog to prevent too many simultaneous connections
  server.listen(port, 8, () => {
    const mem = process.memoryUsage();
    console.log(`> MotoTrack ready on http://localhost:${port} (concurrent: ${MAX_CONCURRENT}, static bypass: ON, RSS: ${Math.round(mem.rss/1024/1024)}MB)`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[INFO] SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });
  
  process.on('SIGINT', () => {
    console.log('[INFO] SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });

  // Memory monitoring every 30s
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MEM] RSS: ${Math.round(mem.rss/1024/1024)}MB, Heap: ${Math.round(mem.heapUsed/1024/1024)}/${Math.round(mem.heapTotal/1024/1024)}MB, Active: ${activeRequests}, Queue: ${queue.length}`);
  }, 30000);
}).catch((err) => {
  console.error('[FATAL] Failed to prepare Next.js:', err);
  process.exit(1);
});
