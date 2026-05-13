import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { startLat, startLng, distance, direction, curviness = 3 } = await req.json()
    if (!startLat || !startLng || !distance) {
      return NextResponse.json({ error: 'startLat, startLng, distance required' }, { status: 400 })
    }

    // Calculate destination point (~60% of distance in chosen direction)
    const R = 6371
    const dirRad = ((direction || Math.random() * 360) * Math.PI) / 180
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

    // Get outbound route
    const outCoords = `${startLng},${startLat};${endLng},${endLat}`
    const outUrl = `https://router.project-osrm.org/route/v1/driving/${outCoords}?overview=full&geometries=geojson`
    const outRes = await fetch(outUrl, { signal: AbortSignal.timeout(10000) })
    if (!outRes.ok) return NextResponse.json({ error: 'Routing failed' }, { status: 502 })
    const outData = await outRes.json()
    if (!outData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

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

    return NextResponse.json({
      data: {
        waypoints,
        totalDistance,
        estimatedDuration: totalDuration,
        geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
        twistyScore,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Round trip failed' }, { status: 500 })
  }
}
