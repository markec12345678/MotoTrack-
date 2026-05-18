import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearingDiff(b1: number, b2: number): number {
  const d = Math.abs(b1 - b2)
  return d > 180 ? 360 - d : d
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface SimPoint {
  lat: number
  lng: number
  alt: number
  bearing: number
  speed: number
  twistiness: number
  distance: number
}

interface SimSegment {
  startIdx: number
  endIdx: number
  type: 'twisty' | 'straight' | 'urban' | 'highway'
  avgSpeed: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { routeId, points: inputPoints } = body as {
      routeId?: string
      points?: Array<{ lat: number; lng: number; alt?: number | null }>
    }

    let rawPoints: Array<{ lat: number; lng: number; alt: number }> = []

    if (routeId) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            rawPoints = rd.map((p: number[]) => ({ lat: p[0], lng: p[1], alt: p[2] ?? 0 }))
          }
        } else {
          const wpRaw = JSON.parse(route.waypoints)
          if (Array.isArray(wpRaw)) {
            rawPoints = wpRaw.map((w: { lat: number; lng: number; alt?: number }) => ({
              lat: w.lat, lng: w.lng, alt: w.alt ?? 0,
            }))
          }
        }
      } catch { /* ignore */ }
    } else if (inputPoints && inputPoints.length >= 2) {
      rawPoints = inputPoints.map(p => ({ lat: p.lat, lng: p.lng, alt: p.alt ?? 0 }))
    } else {
      return NextResponse.json({ error: 'Podajte routeId ali točke' }, { status: 400 })
    }

    if (rawPoints.length < 2) {
      return NextResponse.json({ error: 'Potrebnih vsaj 2 točki' }, { status: 400 })
    }

    // Interpolate points for smooth animation (every ~50m)
    const interpolated: Array<{ lat: number; lng: number; alt: number }> = [rawPoints[0]]
    let cumulativeDistance = 0

    for (let i = 1; i < rawPoints.length; i++) {
      const prev = rawPoints[i - 1]
      const curr = rawPoints[i]
      const segDist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)
      cumulativeDistance += segDist

      const numInterp = Math.max(1, Math.floor(segDist / 50))
      for (let j = 1; j <= numInterp; j++) {
        const t = j / numInterp
        interpolated.push({
          lat: prev.lat + (curr.lat - prev.lat) * t,
          lng: prev.lng + (curr.lng - prev.lng) * t,
          alt: prev.alt + (curr.alt - prev.alt) * t,
        })
      }
    }

    // Calculate bearing, twistiness, and simulated speed for each point
    const simPoints: SimPoint[] = interpolated.map((p, i) => {
      const bearing = i < interpolated.length - 1
        ? calculateBearing(p.lat, p.lng, interpolated[i + 1].lat, interpolated[i + 1].lng)
        : i > 0
          ? calculateBearing(interpolated[i - 1].lat, interpolated[i - 1].lng, p.lat, p.lng)
          : 0

      const windowSize = Math.max(5, Math.min(20, Math.floor(500 / 50)))
      let twistiness = 0
      if (i >= windowSize) {
        let totalDiff = 0
        for (let j = i - windowSize; j < i; j++) {
          const b1 = calculateBearing(interpolated[j].lat, interpolated[j].lng, interpolated[j + 1].lat, interpolated[j + 1].lng)
          const b2 = j + 2 < interpolated.length
            ? calculateBearing(interpolated[j + 1].lat, interpolated[j + 1].lng, interpolated[j + 2].lat, interpolated[j + 2].lng)
            : b1
          totalDiff += bearingDiff(b1, b2)
        }
        twistiness = Math.min(100, (totalDiff / windowSize) * 8)
      }

      let dist = 0
      for (let j = 0; j < i; j++) {
        dist += haversineDistance(interpolated[j].lat, interpolated[j].lng, interpolated[j + 1].lat, interpolated[j + 1].lng)
      }

      let speed = 80
      if (twistiness >= 60) speed = 45 + Math.random() * 35
      else if (twistiness >= 40) speed = 60 + Math.random() * 40
      else if (twistiness >= 20) speed = 80 + Math.random() * 40
      else speed = 90 + Math.random() * 30

      if (i > 0) {
        const altDiff = p.alt - interpolated[i - 1].alt
        if (altDiff > 5) speed = Math.max(30, speed - 20)
        if (altDiff < -5) speed = Math.max(40, speed - 10)
      }

      return { lat: p.lat, lng: p.lng, alt: p.alt, bearing, speed: Math.round(speed), twistiness: Math.round(twistiness), distance: Math.round(dist) }
    })

    // Segment classification
    const segments: SimSegment[] = []
    let segStart = 0
    let segType: SimSegment['type'] = 'straight'

    for (let i = 1; i < simPoints.length; i++) {
      const tw = simPoints[i].twistiness
      const newType: SimSegment['type'] = tw >= 50 ? 'twisty' : tw >= 20 ? 'straight' : 'highway'

      if (newType !== segType || i === simPoints.length - 1) {
        const segPoints = simPoints.slice(segStart, i + 1)
        const avgSpeed = segPoints.length > 0 ? Math.round(segPoints.reduce((s, p) => s + p.speed, 0) / segPoints.length) : 60
        segments.push({ startIdx: segStart, endIdx: i, type: segType, avgSpeed })
        segStart = i
        segType = newType
      }
    }

    return NextResponse.json({
      points: simPoints,
      totalDistance: cumulativeDistance,
      totalDuration: Math.round(cumulativeDistance / (80 / 3.6)),
      segments,
    })
  } catch (error) {
    console.error('Route simulator error:', error)
    return NextResponse.json({ error: 'Napaka pri simulaciji rute' }, { status: 500 })
  }
}
