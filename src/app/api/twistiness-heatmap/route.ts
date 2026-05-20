import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── Twistiness calculation helpers (shared with client) ──────────

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearingDiffFn(b1: number, b2: number): number {
  const d = Math.abs(b1 - b2)
  return d > 180 ? 360 - d : d
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function classifyRoad(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Ekstremna', color: '#10b981' }
  if (score >= 60) return { label: 'Zelo vijugasta', color: '#22c55e' }
  if (score >= 40) return { label: 'Vijugasta', color: '#eab308' }
  if (score >= 20) return { label: 'Rahlo vijugasta', color: '#f97316' }
  return { label: 'Ravna cesta', color: '#ef4444' }
}

const SCALE_FACTOR = 15
const WINDOW_DISTANCE_KM = 0.5

// ─── In-memory cache ──────────────────────────────────────────────

const heatmapCache = new Map<string, { segments: Array<{ start: [number, number]; end: [number, number]; score: number; color: string; label: string }>; computedAt: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// ─── POST handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { routeId, points } = body as {
      routeId?: string
      points?: Array<{ lat: number; lng: number }>
    }

    // If routeId is provided, fetch route from DB
    let pts: Array<{ lat: number; lng: number }> = points || []

    if (routeId && pts.length === 0) {
      // Check cache first
      const cached = heatmapCache.get(routeId)
      if (cached && Date.now() - cached.computedAt < CACHE_TTL) {
        return NextResponse.json({ segments: cached.segments, cached: true })
      }

      // Fetch route from database
      const route = await db.route.findUnique({
        where: { id: routeId },
        select: { waypoints: true, routeData: true },
      })

      if (!route) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 })
      }

      // Parse waypoints
      try {
        const wp = JSON.parse(route.waypoints)
        if (Array.isArray(wp)) {
          pts = wp.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng }))
        }
      } catch {
        // ignore parse errors
      }

      // Also try routeData for more detailed polyline
      if (route.routeData) {
        try {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd) && rd.length > pts.length) {
            pts = rd.map((p: number[]) => ({ lat: p[0], lng: p[1] }))
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    if (pts.length < 3) {
      return NextResponse.json({
        segments: [],
        message: 'Potrebujem vsaj 3 točke za izračun vijugavosti',
      })
    }

    // Compute twistiness segments
    const segments = computeSegments(pts)

    // Cache if routeId provided
    if (routeId) {
      heatmapCache.set(routeId, { segments, computedAt: Date.now() })
    }

    return NextResponse.json({ segments, cached: false })
  } catch (error) {
    console.error('Twistiness heatmap error:', error)
    return NextResponse.json({ error: 'Napaka pri izračunu vijugavosti' }, { status: 500 })
  }
}

function computeSegments(
  points: Array<{ lat: number; lng: number }>
): Array<{ start: [number, number]; end: [number, number]; score: number; color: string; label: string }> {
  // Downsample for performance
  let pts = points
  if (points.length >= 1000) {
    pts = points.filter((_, i) => i % 3 === 0 || i === points.length - 1)
  }

  if (pts.length < 3) return []

  // Calculate bearings
  const bearings: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    bearings.push(calculateBearing(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng))
  }

  // Calculate distances
  const distances: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    distances.push(haversineKm(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng))
  }

  const result: Array<{ start: [number, number]; end: [number, number]; score: number; color: string; label: string }> = []

  for (let i = 1; i < pts.length - 1; i++) {
    // Build a ~500m sliding window
    let windowBearingChange = 0
    let windowDist = 0
    let windowStart = i
    let windowEnd = i

    for (let j = i; j >= 1; j--) {
      const segDist = distances[j - 1] || 0
      if (windowDist + segDist > WINDOW_DISTANCE_KM / 2 && windowDist > 0) break
      windowDist += segDist
      windowStart = j
    }

    for (let j = i; j < bearings.length; j++) {
      const segDist = distances[j] || 0
      windowDist += segDist
      windowEnd = j + 1
      if (windowDist >= WINDOW_DISTANCE_KM) break
    }

    for (let j = Math.max(1, windowStart); j < Math.min(bearings.length, windowEnd); j++) {
      windowBearingChange += bearingDiffFn(bearings[j - 1], bearings[j])
    }

    const effectiveDistance = windowDist > 0.01 ? windowDist : 0.01
    const rawScore = (windowBearingChange / effectiveDistance) * SCALE_FACTOR
    const score = Math.min(100, Math.max(0, Math.round(rawScore)))
    const classification = classifyRoad(score)

    result.push({
      start: [pts[i].lat, pts[i].lng],
      end: [pts[i + 1].lat, pts[i + 1].lng],
      score,
      color: classification.color,
      label: classification.label,
    })
  }

  return result
}
