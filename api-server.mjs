import http from 'http';
import { URL } from 'url';

const PORT = 3001;

// Import Next.js dynamically
async function createApiServer() {
  // We'll use Next.js custom server to handle only API routes
  const { createServer } = await import('http');
  const next = (await import('next')).default;
  
  const app = next({ dev: true, port: PORT });
  const handle = app.getRequestHandler();
  
  await app.prepare();
  
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname = parsedUrl.pathname;
      
      // Only handle API routes
      if (pathname.startsWith('/api/')) {
        await handle(req, res, parsedUrl);
      } else {
        // Reject non-API requests
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found - API only');
      }
    } catch (err) {
      console.error('API server error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });
  
  server.listen(PORT, () => {
    console.log(`> API server on :${PORT}`);
  });
}

createApiServer().catch(err => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
