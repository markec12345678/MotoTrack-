import { NextRequest, NextResponse } from 'next/server'

// Direction name → degrees mapping
const DIRECTION_MAP: Record<string, number> = {
  N: 0, north: 0, sever: 0,
  NE: 45, northeast: 45, severovzhod: 45,
  E: 90, east: 90, vzhod: 90,
  SE: 135, southeast: 135, jugovzhod: 135,
  S: 180, south: 180, jug: 180,
  SW: 225, southwest: 225, jugozahod: 225,
  W: 270, west: 270, zahod: 270,
  NW: 315, northwest: 315, severozahod: 315,
}

function resolveDirection(direction: string | number | undefined): number {
  if (direction === undefined || direction === '') return Math.random() * 360
  if (typeof direction === 'number') return direction
  const num = parseFloat(direction)
  if (!isNaN(num)) return num
  const upper = String(direction).toUpperCase()
  if (DIRECTION_MAP[upper] !== undefined) return DIRECTION_MAP[upper]
  const lower = String(direction).toLowerCase()
  if (DIRECTION_MAP[lower] !== undefined) return DIRECTION_MAP[lower]
  return Math.random() * 360
}

async function generateRoundTrip(
  startLat: number,
  startLng: number,
  distance: number,
  direction: string | number | undefined,
  curviness: number = 3
) {
  // Calculate two intermediate points for a triangular route (more interesting than out-and-back)
  // This creates a proper loop instead of going the same way back
  const R = 6371
  const dirDeg = resolveDirection(direction)
  const dirRad = (dirDeg * Math.PI) / 180
  const lat1 = (startLat * Math.PI) / 180
  const lng1 = (startLng * Math.PI) / 180

  // Point A: ~45% of distance in chosen direction
  const distA = (distance * 0.45) / R
  const latA = Math.asin(Math.sin(lat1) * Math.cos(distA) + Math.cos(lat1) * Math.sin(distA) * Math.cos(dirRad))
  const lngA = lng1 + Math.atan2(
    Math.sin(dirRad) * Math.sin(distA) * Math.cos(lat1),
    Math.cos(distA) - Math.sin(lat1) * Math.sin(latA)
  )
  const pointALat = (latA * 180) / Math.PI
  const pointALng = (lngA * 180) / Math.PI

  // Point B: ~45% of distance in direction + ~90° offset (creates a triangular loop)
  const offsetAngle = curviness >= 4 ? 100 : curviness >= 3 ? 80 : 60 // More offset = wider loop
  const dirBRad = ((dirDeg + offsetAngle) * Math.PI) / 180
  const distB = (distance * 0.45) / R
  const latB = Math.asin(Math.sin(lat1) * Math.cos(distB) + Math.cos(lat1) * Math.sin(distB) * Math.cos(dirBRad))
  const lngB = lng1 + Math.atan2(
    Math.sin(dirBRad) * Math.sin(distB) * Math.cos(lat1),
    Math.cos(distB) - Math.sin(lat1) * Math.sin(latB)
  )
  const pointBLat = (latB * 180) / Math.PI
  const pointBLng = (lngB * 180) / Math.PI

  // Route: Start → Point A → Point B → Start (triangular loop)
  const loopCoords = `${startLng},${startLat};${pointALng},${pointALat};${pointBLng},${pointBLat};${startLng},${startLat}`
  const loopUrl = `https://router.project-osrm.org/route/v1/driving/${loopCoords}?overview=full&geometries=geojson`
  const loopRes = await fetch(loopUrl, { signal: AbortSignal.timeout(15000) })

  if (!loopRes.ok) {
    // Fallback: try simpler out-and-back route
    const outCoords = `${startLng},${startLat};${pointALng},${pointALat};${startLng},${startLat}`
    const outRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${outCoords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10000) })
    if (!outRes.ok) return { error: 'Routing failed', status: 502 }
    const outData = await outRes.json()
    if (!outData.routes?.length) return { error: 'No route found', status: 404 }
    const route = outData.routes[0]
    const allCoords = route.geometry.coordinates
    const totalDistance = Math.round(route.distance)
    const totalDuration = Math.round(route.duration)
    let totalAngle = 0
    for (let i = 2; i < allCoords.length; i++) {
      const b1 = Math.atan2(allCoords[i - 1][0] - allCoords[i - 2][0], allCoords[i - 1][1] - allCoords[i - 2][1])
      const b2 = Math.atan2(allCoords[i][0] - allCoords[i - 1][0], allCoords[i][1] - allCoords[i - 1][1])
      let diff = Math.abs(b2 - b1)
      if (diff > Math.PI) diff = 2 * Math.PI - diff
      totalAngle += diff
    }
    const avgAngle = allCoords.length > 2 ? (totalAngle / (allCoords.length - 2)) * (180 / Math.PI) : 0
    const twistyScore = Math.min(10, Math.max(1, Math.round(avgAngle * 20 * (curviness / 3))))
    const waypoints = allCoords
      .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
      .map((c: number[]) => ({ lat: c[1], lng: c[0] }))
    return {
      data: { waypoints, totalDistance, estimatedDuration: totalDuration, geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]), twistyScore, isLoop: false }
    }
  }

  const loopData = await loopRes.json()
  if (!loopData.routes?.length) return { error: 'No route found', status: 404 }

  const route = loopData.routes[0]
  const allCoords = route.geometry.coordinates
  const totalDistance = Math.round(route.distance)
  const totalDuration = Math.round(route.duration)

  // Calculate twisty score
  let totalAngle = 0
  for (let i = 2; i < allCoords.length; i++) {
    const b1 = Math.atan2(allCoords[i - 1][0] - allCoords[i - 2][0], allCoords[i - 1][1] - allCoords[i - 2][1])
    const b2 = Math.atan2(allCoords[i][0] - allCoords[i - 1][0], allCoords[i][1] - allCoords[i - 1][1])
    let diff = Math.abs(b2 - b1)
    if (diff > Math.PI) diff = 2 * Math.PI - diff
    totalAngle += diff
  }
  const avgAngle = allCoords.length > 2 ? (totalAngle / (allCoords.length - 2)) * (180 / Math.PI) : 0
  const twistyScore = Math.min(10, Math.max(1, Math.round(avgAngle * 20 * (curviness / 3))))

  // Sample waypoints for display (max ~30)
  const waypoints = allCoords
    .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
    .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

  return {
    data: {
      waypoints,
      totalDistance,
      estimatedDuration: totalDuration,
      geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
      twistyScore,
      isLoop: true,
      loopPoints: { a: { lat: pointALat, lng: pointALng }, b: { lat: pointBLat, lng: pointBLng } },
    }
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startLat = parseFloat(searchParams.get('startLat') || '')
    const startLng = parseFloat(searchParams.get('startLng') || '')
    const distance = parseFloat(searchParams.get('distance') || '')
    const direction = searchParams.get('direction') || undefined
    const curviness = parseFloat(searchParams.get('curviness') || '3')

    if (isNaN(startLat) || isNaN(startLng) || isNaN(distance)) {
      return NextResponse.json({ error: 'startLat, startLng, distance required' }, { status: 400 })
    }

    const result = await generateRoundTrip(startLat, startLng, distance, direction, curviness)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message || 'Round trip failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { startLat, startLng, distance, direction, curviness = 3 } = await req.json()
    if (!startLat || !startLng || !distance) {
      return NextResponse.json({ error: 'startLat, startLng, distance required' }, { status: 400 })
    }

    const result = await generateRoundTrip(startLat, startLng, distance, direction, curviness)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message || 'Round trip failed' }, { status: 500 })
  }
}
