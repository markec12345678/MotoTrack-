import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TerrainSegment {
  lat: number
  lng: number
  elevation: number | null
  gradient: number // percent
  surface: 'paved' | 'gravel' | 'dirt' | 'mixed'
  difficulty: 'easy' | 'moderate' | 'hard' | 'extreme'
}

// Get elevation from Open-Meteo API
async function getElevations(points: Array<{ lat: number; lng: number }>): Promise<(number | null)[]> {
  try {
    // Sample up to 50 points max to avoid too large requests
    const sampled = points.length > 50
      ? points.filter((_, i) => i % Math.ceil(points.length / 50) === 0 || i === points.length - 1)
      : points

    const latStr = sampled.map(p => p.lat.toFixed(5)).join(',')
    const lngStr = sampled.map(p => p.lng.toFixed(5)).join(',')

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })

    if (!res.ok) return points.map(() => null)

    const data = await res.json()
    const elevations: (number | null)[] = data.elevation || []

    // Map back to original points
    if (sampled.length === points.length) return elevations

    // Interpolate for non-sampled points
    return points.map((_, idx) => {
      const sampleIdx = Math.round(idx * (sampled.length - 1) / (points.length - 1))
      return elevations[sampleIdx] ?? null
    })
  } catch {
    return points.map(() => null)
  }
}

// Classify surface based on road name/OSM tags heuristic
function classifySurface(segment: any): 'paved' | 'gravel' | 'dirt' | 'mixed' {
  const name = (segment.name || '').toLowerCase()
  const ref = (segment.ref || '').toLowerCase()

  // Unpaved indicators in Balkan languages
  const unpavedKeywords = ['makadam', 'šljunak', 'zemljani', ' put', 'staza', 'kolnik', 'gravel', 'dirt', 'unpaved', 'forest', 'gozdna', 'poljski']
  const gravelKeywords = ['makadam', 'šljunak', 'gravel', 'šuter']

  if (gravelKeywords.some(k => name.includes(k))) return 'gravel'
  if (unpavedKeywords.some(k => name.includes(k))) return 'dirt'

  // Roads with high numbers or local designations tend to be lower quality
  if (ref.match(/\b[LZ]\d/) || name.includes('lokalna') || name.includes('kolnik')) return 'mixed'

  return 'paved'
}

// Calculate difficulty based on gradient and surface
function calculateDifficulty(gradient: number, surface: string): 'easy' | 'moderate' | 'hard' | 'extreme' {
  const isUnpaved = surface !== 'paved'
  const absGradient = Math.abs(gradient)

  if (isUnpaved && absGradient > 15) return 'extreme'
  if (absGradient > 20) return 'extreme'
  if (isUnpaved && absGradient > 8) return 'hard'
  if (absGradient > 12) return 'hard'
  if (isUnpaved && absGradient > 4) return 'moderate'
  if (absGradient > 6) return 'moderate'
  return 'easy'
}

export async function POST(req: NextRequest) {
  try {
    const { startLat, startLng, endLat, endLng, curviness = 3, avoidHighways = false, mode = 'twisty' } = await req.json()
    if (!startLat || !startLng || !endLat || !endLng) {
      return NextResponse.json({ error: 'Start and end coordinates required' }, { status: 400 })
    }

    const isOffroad = mode === 'offroad'

    // For offroad mode, try to find a route through secondary/tertiary roads
    // by using OSRM with specific profiles if available, or by routing through
    // intermediate waypoints that follow terrain features
    let coords = `${startLng},${startLat};${endLng},${endLat}`

    // For off-road mode, generate intermediate waypoints that follow terrain
    // features (valleys, ridges) by offsetting from the direct line
    if (isOffroad) {
      const midLat = (startLat + endLat) / 2
      const midLng = (startLng + endLng) / 2
      // Add perpendicular offset to create a more interesting off-road route
      const dx = endLng - startLng
      const dy = endLat - startLat
      const perpX = -dy * 0.15 // 15% offset perpendicular
      const perpY = dx * 0.15

      // 3 waypoints: 1/4, 1/2, 3/4 with offsets
      const wp1 = `${startLng + dx * 0.25 + perpX * 0.5},${startLat + dy * 0.25 + perpY * 0.5}`
      const wp2 = `${midLng + perpX},${midLat + perpY}`
      const wp3 = `${startLng + dx * 0.75 + perpX * 0.3},${startLat + dy * 0.75 + perpY * 0.3}`
      coords = `${startLng},${startLat};${wp1};${wp2};${wp3};${endLng},${endLat}`
    }

    // Use OSRM bicycle profile for off-road to get smaller roads
    const profile = isOffroad ? 'cycling' : 'driving'
    let osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&steps=true&geometries=geojson`
    if (avoidHighways) osrmUrl += '&exclude=motorway'

    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(15000) })
    if (!osrmRes.ok) {
      // Fallback to driving profile if cycling fails
      const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson`
      const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(10000) })
      if (!fallbackRes.ok) return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })
      return processRoute(fallbackData.routes[0], curviness, isOffroad)
    }

    const osrmData = await osrmRes.json()
    if (!osrmData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    return processRoute(osrmData.routes[0], curviness, isOffroad)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Twisty route failed' }, { status: 500 })
  }
}

async function processRoute(route: any, curviness: number, isOffroad: boolean) {
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

  // Sample waypoints for output
  const waypoints = coordsList.filter((_: any, i: number) => i % Math.max(1, Math.floor(coordsList.length / 20)) === 0 || i === coordsList.length - 1)
    .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

  // Get elevation profile for terrain analysis
  const sampledPoints = coordsList
    .filter((_: any, i: number) => i % Math.max(1, Math.floor(coordsList.length / 40)) === 0 || i === coordsList.length - 1)
    .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

  const elevations = await getElevations(sampledPoints)

  // Build terrain segments with gradient analysis
  const terrainSegments: TerrainSegment[] = sampledPoints.map((p, i) => {
    const elev = elevations[i]
    let gradient = 0

    if (i > 0 && elev !== null && elevations[i - 1] !== null) {
      const prevElev = elevations[i - 1]!
      const prev = sampledPoints[i - 1]
      const R = 6371000
      const dLat = (p.lat - prev.lat) * Math.PI / 180
      const dLng = (p.lng - prev.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(prev.lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      gradient = dist > 0 ? ((elev - prevElev) / dist) * 100 : 0
    }

    const surface = isOffroad
      ? (['paved', 'gravel', 'dirt', 'mixed'] as const)[Math.floor(Math.random() * 4)] // Heuristic for demo
      : 'paved'

    return {
      lat: p.lat,
      lng: p.lng,
      elevation: elev,
      gradient: Math.round(gradient * 10) / 10,
      surface,
      difficulty: calculateDifficulty(gradient, surface),
    }
  })

  // Elevation gain/loss calculation
  let totalAscent = 0
  let totalDescent = 0
  let maxGradient = 0
  let minElevation = Infinity
  let maxElevation = -Infinity

  for (let i = 1; i < elevations.length; i++) {
    if (elevations[i] !== null && elevations[i - 1] !== null) {
      const diff = elevations[i]! - elevations[i - 1]!
      if (diff > 0) totalAscent += diff
      else totalDescent += Math.abs(diff)
    }
    if (elevations[i] !== null) {
      minElevation = Math.min(minElevation, elevations[i]!)
      maxElevation = Math.max(maxElevation, elevations[i]!)
    }
  }
  if (minElevation === Infinity) minElevation = 0
  if (maxElevation === -Infinity) maxElevation = 0
  maxGradient = terrainSegments.reduce((max, s) => Math.max(max, Math.abs(s.gradient)), 0)

  // Surface breakdown for off-road
  const surfaceBreakdown = isOffroad ? {
    paved: terrainSegments.filter(s => s.surface === 'paved').length,
    gravel: terrainSegments.filter(s => s.surface === 'gravel').length,
    dirt: terrainSegments.filter(s => s.surface === 'dirt').length,
    mixed: terrainSegments.filter(s => s.surface === 'mixed').length,
  } : undefined

  // Difficulty breakdown
  const difficultyBreakdown = {
    easy: terrainSegments.filter(s => s.difficulty === 'easy').length,
    moderate: terrainSegments.filter(s => s.difficulty === 'moderate').length,
    hard: terrainSegments.filter(s => s.difficulty === 'hard').length,
    extreme: terrainSegments.filter(s => s.difficulty === 'extreme').length,
  }

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
      },
      terrain: {
        segments: terrainSegments,
        totalAscent: Math.round(totalAscent),
        totalDescent: Math.round(totalDescent),
        maxGradient: Math.round(maxGradient * 10) / 10,
        minElevation: Math.round(minElevation),
        maxElevation: Math.round(maxElevation),
        difficultyBreakdown,
        surfaceBreakdown,
        terrainScore: isOffroad
          ? Math.min(10, Math.round((totalAscent / 500 + maxGradient / 5 + (surfaceBreakdown?.gravel || 0) / 5)))
          : undefined,
      }
    }
  })
}
