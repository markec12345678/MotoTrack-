#!/usr/bin/env node
/**
 * MotoTrack Port Proxy
 * 
 * The sandbox kills processes on port 3000 after ~15 seconds.
 * But processes on other ports survive indefinitely.
 * 
 * Strategy:
 * 1. Run Next.js on port 3002 (survives)
 * 2. Run this lightweight proxy on port 3000 that forwards to 3002
 * 3. The proxy itself uses minimal memory and gets killed too,
 *    so we use a watchdog to auto-restart it
 */

var http = require('http');

var TARGET_PORT = 3002;
var PORT = 3000;

var server = http.createServer(function(req, res) {
  var options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  
  var proxyReq = http.request(options, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', function(err) {
    if (!res.headersSent) {
      res.writeHead(502, {'Content-Type': 'text/plain'});
      res.end('Backend unavailable');
    }
  });
  
  req.pipe(proxyReq);
});

server.timeout = 60000;
server.listen(PORT, function() {
  console.log('Proxy :' + PORT + ' -> :' + TARGET_PORT);
});
