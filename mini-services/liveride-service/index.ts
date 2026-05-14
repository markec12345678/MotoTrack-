import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3002

const httpServer = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'liveride',
      riders: liveRiders.size,
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Live riders store: Map<userId, RiderData>
interface RiderData {
  userId: string
  userName: string
  rideId: string | null
  lat: number
  lng: number
  speed: number
  heading: number
  lastUpdate: number
  socketId: string
}

const liveRiders = new Map<string, RiderData>()

// Cleanup: remove riders who haven't updated in 5 minutes
const CLEANUP_INTERVAL = 60_000 // 1 minute check
const RIDER_TIMEOUT = 5 * 60_000 // 5 minutes

setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of liveRiders) {
    if (now - data.lastUpdate > RIDER_TIMEOUT) {
      console.log(`[cleanup] Removing stale rider: ${data.userName} (${userId})`)
      io.emit('rider-left', { userId, rideId: data.rideId })
      liveRiders.delete(userId)
    }
  }
}, CLEANUP_INTERVAL)

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // Send current live riders to newly connected client
  const riders = Array.from(liveRiders.values()).map(r => ({
    userId: r.userId,
    userName: r.userName,
    rideId: r.rideId,
    lat: r.lat,
    lng: r.lng,
    speed: r.speed,
    heading: r.heading,
    lastUpdate: r.lastUpdate,
  }))
  socket.emit('live-riders', riders)

  // Join a ride session
  socket.on('join-ride', (data: { userId: string; userName: string; rideId: string }) => {
    const { userId, userName, rideId } = data
    console.log(`[join-ride] ${userName} joined ride ${rideId}`)

    const existing = liveRiders.get(userId)
    const riderData: RiderData = {
      userId,
      userName,
      rideId,
      lat: existing?.lat ?? 0,
      lng: existing?.lng ?? 0,
      speed: existing?.speed ?? 0,
      heading: existing?.heading ?? 0,
      lastUpdate: Date.now(),
      socketId: socket.id,
    }
    liveRiders.set(userId, riderData)
    socket.join(`ride:${rideId}`)

    io.emit('rider-joined', { userId, userName, rideId })
  })

  // Leave a ride session
  socket.on('leave-ride', (data: { userId: string; rideId: string }) => {
    const { userId, rideId } = data
    console.log(`[leave-ride] ${userId} left ride ${rideId}`)

    const rider = liveRiders.get(userId)
    if (rider) {
      socket.leave(`ride:${rideId}`)
      liveRiders.delete(userId)
      io.emit('rider-left', { userId, rideId })
    }
  })

  // Location update
  socket.on('location-update', (data: {
    userId: string
    rideId: string
    lat: number
    lng: number
    speed: number
    heading: number
    timestamp?: number
  }) => {
    const { userId, rideId, lat, lng, speed, heading } = data
    const existing = liveRiders.get(userId)

    if (existing) {
      existing.lat = lat
      existing.lng = lng
      existing.speed = speed
      existing.heading = heading
      existing.lastUpdate = Date.now()
      existing.socketId = socket.id
    } else {
      liveRiders.set(userId, {
        userId,
        userName: 'Rider',
        rideId,
        lat, lng, speed, heading,
        lastUpdate: Date.now(),
        socketId: socket.id,
      })
    }

    io.emit('rider-location', { userId, rideId, lat, lng, speed, heading, timestamp: Date.now() })
  })

  // Get live riders
  socket.on('get-live-riders', (data: { rideId?: string }) => {
    let riders = Array.from(liveRiders.values())
    if (data?.rideId) {
      riders = riders.filter(r => r.rideId === data.rideId)
    }
    socket.emit('live-riders', riders.map(r => ({
      userId: r.userId,
      userName: r.userName,
      rideId: r.rideId,
      lat: r.lat,
      lng: r.lng,
      speed: r.speed,
      heading: r.heading,
      lastUpdate: r.lastUpdate,
    })))
  })

  // Disconnect
  socket.on('disconnect', () => {
    for (const [userId, data] of liveRiders) {
      if (data.socketId === socket.id) {
        console.log(`[disconnect] ${data.userName} (${userId})`)
        io.emit('rider-left', { userId, rideId: data.rideId })
        liveRiders.delete(userId)
        break
      }
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`🟢 LiveRIDE WebSocket service running on port ${PORT}`)
})
