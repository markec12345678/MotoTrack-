// Tiny redirect server on port 3000
// Serves the patched HTML (which includes XTransformPort=3002 in fetch calls)
// and redirects all other requests to ?XTransformPort=3002
const http = require('http');
const fs = require('fs');
const path = require('path');
const BASE = '/home/z/my-project';

let INDEX_HTML;
try { INDEX_HTML = fs.readFileSync(path.join(BASE, '.next', 'cached-index.html')); }
catch(e) { INDEX_HTML = Buffer.from('<h1>Loading...</h1>'); }

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  // Serve the patched HTML for root
  if (p === '/' || p === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Connection': 'close' });
    return res.end(INDEX_HTML);
  }
  // Redirect all other requests to XTransformPort=3002
  res.writeHead(302, {
    'Location': req.url + (req.url.includes('?') ? '&' : '?') + 'XTransformPort=3002',
    'Connection': 'close'
  });
  return res.end();
});

server.listen(3000, () => {
  console.log('[Redirect] Port 3000 → XTransformPort=3002');
});
