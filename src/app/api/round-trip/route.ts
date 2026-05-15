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
  // Calculate destination point (~60% of distance in chosen direction)
  const R = 6371
  const dirDeg = resolveDirection(direction)
  const dirRad = (dirDeg * Math.PI) / 180
  const destDist = (distance * 0.6) / R
  const lat1 = (startLat * Math.PI) / 180
  const lng1 = (startLng * Math.PI) / 180

  const destLat = Math.asin(Math.sin(lat1) * Math.cos(destDist) + Math.cos(lat1) * Math.sin(destDist) * Math.cos(dirRad))
  const destLng = lng1 + Math.atan2(
    Math.sin(dirRad) * Math.sin(destDist) * Math.cos(lat1),
    Math.cos(destDist) - Math.sin(lat1) * Math.sin(destLat)
  )

  const endLat = (destLat * 180) / Math.PI
  const endLng = (destLng * 180) / Math.PI

  // Get outbound route via OSRM
  const outCoords = `${startLng},${startLat};${endLng},${endLat}`
  const outUrl = `https://router.project-osrm.org/route/v1/driving/${outCoords}?overview=full&geometries=geojson`
  const outRes = await fetch(outUrl, { signal: AbortSignal.timeout(10000) })
  if (!outRes.ok) return { error: 'Routing failed', status: 502 }
  const outData = await outRes.json()
  if (!outData.routes?.length) return { error: 'No route found', status: 404 }

  // Get return route (direct back)
  const retCoords = `${endLng},${endLat};${startLng},${startLat}`
  const retUrl = `https://router.project-osrm.org/route/v1/driving/${retCoords}?overview=full&geometries=geojson`
  const retRes = await fetch(retUrl, { signal: AbortSignal.timeout(10000) })
  const retData = await retRes.json()

  const outRoute = outData.routes[0]
  const retRoute = retData.routes?.[0]

  const allCoords = [
    ...outRoute.geometry.coordinates,
    ...(retRoute ? retRoute.geometry.coordinates : []),
  ]

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

  const totalDistance = Math.round(outRoute.distance + (retRoute?.distance || 0))
  const totalDuration = Math.round(outRoute.duration + (retRoute?.duration || 0))

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
