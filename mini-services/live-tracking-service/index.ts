import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3004

const httpServer = createServer((req, res) => {
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
      service: 'live-tracking',
      activeSessions: trackingSessions.size,
      activeRiders: liveRiders.size,
      uptime: process.uptime(),
    }))
    return
  }

  if (req.url === '/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const sessions = Array.from(trackingSessions.values()).map(s => ({
      id: s.id,
      hostUserId: s.hostUserId,
      hostUserName: s.hostUserName,
      destination: s.destination,
      riders: s.riders.size,
      createdAt: s.createdAt,
    }))
    res.end(JSON.stringify({ data: sessions }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

interface RiderData {
  userId: string
  userName: string
  sessionId: string | null
  lat: number
  lng: number
  speed: number
  heading: number
  altitude: number
  destination: { lat: number; lng: number } | null
  lastUpdate: number
  socketId: string
}

interface TrackingSession {
  id: string
  hostUserId: string
  hostUserName: string
  destination: { lat: number; lng: number; name?: string } | null
  riders: Set<string>
  createdAt: number
}

const liveRiders = new Map<string, RiderData>()
const trackingSessions = new Map<string, TrackingSession>()

// Cleanup stale riders and sessions
const CLEANUP_INTERVAL = 60_000
const RIDER_TIMEOUT = 5 * 60_000

setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of liveRiders) {
    if (now - data.lastUpdate > RIDER_TIMEOUT) {
      console.log(`[cleanup] Removing stale rider: ${data.userName} (${userId})`)
      io.emit('rider-left', { userId, sessionId: data.sessionId })
      // Remove from session
      if (data.sessionId) {
        const session = trackingSessions.get(data.sessionId)
        if (session) {
          session.riders.delete(userId)
          if (session.riders.size === 0) {
            trackingSessions.delete(data.sessionId)
          }
        }
      }
      liveRiders.delete(userId)
    }
  }

  // Cleanup empty sessions
  for (const [id, session] of trackingSessions) {
    if (session.riders.size === 0) {
      trackingSessions.delete(id)
    }
  }
}, CLEANUP_INTERVAL)

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // Send current state to new client
  const riders = Array.from(liveRiders.values()).map(r => ({
    userId: r.userId,
    userName: r.userName,
    sessionId: r.sessionId,
    lat: r.lat,
    lng: r.lng,
    speed: r.speed,
    heading: r.heading,
    altitude: r.altitude,
    destination: r.destination,
    lastUpdate: r.lastUpdate,
  }))
  socket.emit('live-riders', riders)

  // Get active sessions
  const sessions = Array.from(trackingSessions.values()).map(s => ({
    id: s.id,
    hostUserId: s.hostUserId,
    hostUserName: s.hostUserName,
    destination: s.destination,
    riders: Array.from(s.riders),
    createdAt: s.createdAt,
  }))
  socket.emit('active-sessions', sessions)

  // Join a tracking session
  socket.on('join-tracking', (data: {
    userId: string
    userName: string
    sessionId?: string
    destination?: { lat: number; lng: number; name?: string }
  }) => {
    const { userId, userName, sessionId, destination } = data
    console.log(`[join-tracking] ${userName} joined${sessionId ? ` session ${sessionId}` : ''}`)

    // Create or join session
    let sid = sessionId
    if (!sid) {
      // Create new session
      sid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const session: TrackingSession = {
        id: sid,
        hostUserId: userId,
        hostUserName: userName,
        destination: destination || null,
        riders: new Set([userId]),
        createdAt: Date.now(),
      }
      trackingSessions.set(sid, session)
    } else {
      const session = trackingSessions.get(sid)
      if (session) {
        session.riders.add(userId)
      }
    }

    const existing = liveRiders.get(userId)
    const riderData: RiderData = {
      userId,
      userName,
      sessionId: sid,
      lat: existing?.lat ?? 0,
      lng: existing?.lng ?? 0,
      speed: existing?.speed ?? 0,
      heading: existing?.heading ?? 0,
      altitude: existing?.altitude ?? 0,
      destination: destination || existing?.destination || null,
      lastUpdate: Date.now(),
      socketId: socket.id,
    }
    liveRiders.set(userId, riderData)

    socket.join(`tracking:${sid}`)

    // Broadcast rider joined
    io.emit('rider-joined', {
      userId,
      userName,
      sessionId: sid,
      destination: riderData.destination,
    })

    // Send session info to the rider
    socket.emit('session-info', {
      sessionId: sid,
      destination: riderData.destination || trackingSessions.get(sid)?.destination,
    })
  })

  // Location update
  socket.on('location-update', (data: {
    userId: string
    lat: number
    lng: number
    speed: number
    heading: number
    altitude?: number
  }) => {
    const { userId, lat, lng, speed, heading, altitude } = data
    const existing = liveRiders.get(userId)

    if (existing) {
      existing.lat = lat
      existing.lng = lng
      existing.speed = speed
      existing.heading = heading
      existing.altitude = altitude || existing.altitude
      existing.lastUpdate = Date.now()
      existing.socketId = socket.id

      // Calculate ETA if destination exists
      let eta: number | null = null
      if (existing.destination) {
        const R = 6371
        const dLat = ((existing.destination.lat - lat) * Math.PI) / 180
        const dLon = ((existing.destination.lng - lng) * Math.PI) / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((existing.destination.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        if (speed > 0) {
          eta = (dist / (speed / 3.6)) * 60 // minutes
        }
      }

      io.emit('rider-location', {
        userId,
        lat, lng, speed, heading,
        altitude: existing.altitude,
        eta,
        sessionId: existing.sessionId,
        timestamp: Date.now(),
      })
    } else {
      liveRiders.set(userId, {
        userId,
        userName: 'Rider',
        sessionId: null,
        lat, lng, speed, heading,
        altitude: altitude || 0,
        destination: null,
        lastUpdate: Date.now(),
        socketId: socket.id,
      })
      io.emit('rider-location', {
        userId, lat, lng, speed, heading,
        altitude: altitude || 0,
        eta: null,
        sessionId: null,
        timestamp: Date.now(),
      })
    }
  })

  // Leave tracking session
  socket.on('leave-tracking', (data: { userId: string; sessionId?: string }) => {
    const { userId, sessionId } = data
    console.log(`[leave-tracking] ${userId} left${sessionId ? ` session ${sessionId}` : ''}`)

    const rider = liveRiders.get(userId)
    if (rider) {
      if (rider.sessionId) {
        const session = trackingSessions.get(rider.sessionId)
        if (session) {
          session.riders.delete(userId)
          if (session.riders.size === 0) {
            trackingSessions.delete(rider.sessionId)
          }
        }
      }
      liveRiders.delete(userId)
      io.emit('rider-left', { userId, sessionId: rider.sessionId })
    }
  })

  // Get active sessions
  socket.on('get-active-sessions', () => {
    const sessions = Array.from(trackingSessions.values()).map(s => ({
      id: s.id,
      hostUserId: s.hostUserId,
      hostUserName: s.hostUserName,
      destination: s.destination,
      riders: Array.from(s.riders),
      createdAt: s.createdAt,
    }))
    socket.emit('active-sessions', sessions)
  })

  // Disconnect
  socket.on('disconnect', () => {
    for (const [userId, data] of liveRiders) {
      if (data.socketId === socket.id) {
        console.log(`[disconnect] ${data.userName} (${userId})`)
        if (data.sessionId) {
          const session = trackingSessions.get(data.sessionId)
          if (session) {
            session.riders.delete(userId)
            if (session.riders.size === 0) {
              trackingSessions.delete(data.sessionId)
            }
          }
        }
        io.emit('rider-left', { userId, sessionId: data.sessionId })
        liveRiders.delete(userId)
        break
      }
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`🟢 Live Tracking WebSocket service running on port ${PORT}`)
})
