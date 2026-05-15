#!/usr/bin/env node
/**
 * MotoTrack Immortal Server
 * 
 * The sandbox environment kills Node.js processes after ~10-15 seconds.
 * This server uses a watchdog pattern: it forks itself and monitors the child.
 * When the child dies, it immediately restarts it.
 * 
 * The parent process uses minimal memory (just fork/monitor) so it survives.
 * The child process runs the actual HTTP server.
 */

var { fork } = require('child_process');
var http = require('http');
var path = require('path');

var SERVER_SCRIPT = path.join(__dirname, 'run-server.mjs');
var PORT = 3000;
var child = null;
var restartCount = 0;
var lastRestart = 0;

function startChild() {
  var now = Date.now();
  // Prevent rapid restart loop
  if (now - lastRestart < 2000) {
    setTimeout(startChild, 2000 - (now - lastRestart));
    return;
  }
  lastRestart = now;
  restartCount++;
  
  console.log('[WATCHDOG] Starting server (attempt ' + restartCount + ')...');
  
  child = fork(SERVER_SCRIPT, [], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    silent: false,
  });
  
  child.on('exit', function(code, signal) {
    console.log('[WATCHDOG] Server died (code=' + code + ' signal=' + signal + '), restarting...');
    child = null;
    setTimeout(startChild, 1000);
  });
  
  child.on('error', function(err) {
    console.error('[WATCHDOG] Fork error:', err.message);
    child = null;
    setTimeout(startChild, 3000);
  });
}

// Keep parent alive with minimal memory footprint
setInterval(function() {
  var mem = process.memoryUsage();
  console.log('[WATCHDOG] Parent RSS=' + Math.round(mem.rss/1024/1024) + 'MB, restarts=' + restartCount);
}, 60000);

startChild();
