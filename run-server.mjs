#!/usr/bin/env node
/**
 * MotoTrack Production Server
 * Starts Next.js in production mode with memory monitoring
 */
import { createServer } from 'http'
import next from 'next'

const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev: false })
const handle = app.getRequestHandler()

// Memory monitor
setInterval(() => {
  const m = process.memoryUsage()
  console.log(`[MEM] RSS=${Math.round(m.rss/1024/1024)}MB Heap=${Math.round(m.heapUsed/1024/1024)}MB`)
}, 30000)

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res).catch(err => {
      console.error('Request error:', err.message)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Server Error')
      }
    })
  })

  server.timeout = 60000
  server.keepAliveTimeout = 5000
  server.headersTimeout = 65000

  server.listen(port, () => {
    console.log(`> MotoTrack ready on :${port}`)
  })

  server.on('error', (err) => {
    console.error('Server error:', err.message)
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...')
    server.close(() => process.exit(0))
  })
}).catch(err => {
  console.error('Fatal init error:', err)
  process.exit(1)
})
