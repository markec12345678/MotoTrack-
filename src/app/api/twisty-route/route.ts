import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { startLat, startLng, endLat, endLng, curviness = 3, avoidHighways = false } = await req.json()
    if (!startLat || !startLng || !endLat || !endLng) {
      return NextResponse.json({ error: 'Start and end coordinates required' }, { status: 400 })
    }

    const coords = `${startLng},${startLat};${endLng},${endLat}`
    let osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&steps=true&geometries=geojson`
    if (avoidHighways) osrmUrl += '&exclude=motorway'

    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) })
    if (!osrmRes.ok) return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })

    const osrmData = await osrmRes.json()
    if (!osrmData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    const route = osrmData.routes[0]
    const coordsList = route.geometry.coordinates

    // Calculate twisty score based on angle changes between segments
    let totalAngleChange = 0
    let segmentCount = 0
    for (let i = 2; i < coordsList.length; i++) {
      const [lng1, lat1] = coordsList[i - 2]
      const [lng2, lat2] = coordsList[i - 1]
      const [lng3, lat3] = coordsList[i]
      const bearing1 = Math.atan2(lng2 - lng1, lat2 - lat1)
      const bearing2 = Math.atan2(lng3 - lng2, lat3 - lat2)
      let angleDiff = Math.abs(bearing2 - bearing1)
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
      totalAngleChange += angleDiff
      segmentCount++
    }
    const avgAngle = segmentCount > 0 ? (totalAngleChange / segmentCount) * (180 / Math.PI) : 0

    // Adjust twisty score based on curviness preference
    const baseScore = Math.min(10, Math.round(avgAngle * 20))
    const twistyScore = Math.min(10, Math.max(1, Math.round(baseScore * (curviness / 3))))

    const straightPct = Math.max(0, Math.round(100 - avgAngle * 300))
    const tightCurvesPct = Math.min(100, Math.round(avgAngle * 150))
    const curvesPct = 100 - straightPct - tightCurvesPct

    const waypoints = coordsList.filter((_: any, i: number) => i % Math.max(1, Math.floor(coordsList.length / 20)) === 0 || i === coordsList.length - 1)
      .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

    return NextResponse.json({
      data: {
        waypoints,
        totalDistance: Math.round(route.distance),
        estimatedDuration: Math.round(route.duration),
        twistyScore,
        geometry: coordsList.map((c: number[]) => [c[1], c[0]] as [number, number]),
        curvinessReport: {
          straight: Math.max(0, straightPct),
          curves: Math.max(0, curvesPct),
          tightCurves: Math.min(100, tightCurvesPct),
        }
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Twisty route failed' }, { status: 500 })
  }
}
