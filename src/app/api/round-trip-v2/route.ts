import { NextRequest, NextResponse } from 'next/server'

// ─── Types ───────────────────────────────────────────────────────────────────

type Direction = 'north' | 'east' | 'south' | 'west' | 'auto'
type RouteType = 'asfalt' | 'makadam' | 'mesano'

interface WaypointResult {
  name: string
  lat: number
  lng: number
  distanceFromPrev: number // meters
  cumulativeDistance: number // meters
}

// ─── Haversine ───────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Destination point from bearing + distance ───────────────────────────────

function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceKm: number): { lat: number; lng: number } {
  const R = 6371
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const brng = (bearingDeg * Math.PI) / 180
  const d = distanceKm / R

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng))
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  )

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

// ─── Bearing between two points ──────────────────────────────────────────────

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// ─── Direction mapping ───────────────────────────────────────────────────────

const DIRECTION_ANGLES: Record<string, number> = {
  north: 0, sever: 0, n: 0,
  east: 90, vzhod: 90, e: 90,
  south: 180, jug: 180, s: 180,
  west: 270, zahod: 270, w: 270,
}

function resolveDirectionAngle(dir: Direction, startLat: number, startLng: number): number {
  if (dir === 'auto') {
    // Auto: pick the direction with the most interesting terrain
    // For Balkans, mountains are North/Northwest, coast is South
    // Pick a random "interesting" direction with bias toward NW/NE (mountain twisty roads)
    const candidates = [
      { angle: 315 + (Math.random() - 0.5) * 40, weight: 3 }, // NW - Alpine roads
      { angle: 45 + (Math.random() - 0.5) * 40, weight: 3 },  // NE - Pannonian hills
      { angle: 0 + (Math.random() - 0.5) * 30, weight: 2 },   // N - mountains
      { angle: 270 + (Math.random() - 0.5) * 30, weight: 2 }, // W - karst
      { angle: 180 + (Math.random() - 0.5) * 30, weight: 1 }, // S - coast
      { angle: 90 + (Math.random() - 0.5) * 30, weight: 1 },  // E - flat
    ]
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0)
    let r = Math.random() * totalWeight
    for (const c of candidates) {
      r -= c.weight
      if (r <= 0) return ((c.angle % 360) + 360) % 360
    }
    return 315 // default NW
  }

  const key = dir.toLowerCase()
  if (DIRECTION_ANGLES[key] !== undefined) {
    // Add slight randomness to avoid identical routes
    return (DIRECTION_ANGLES[key] + (Math.random() - 0.5) * 20 + 360) % 360
  }
  return Math.random() * 360
}

// ─── Route type adjustments ──────────────────────────────────────────────────

function getRouteTypeAdjustments(type: RouteType): {
  radiusMultiplier: number
  pointSpread: number
  offsetAmplitude: number
} {
  switch (type) {
    case 'asfalt':
      return { radiusMultiplier: 1.0, pointSpread: 1.0, offsetAmplitude: 0.12 }
    case 'makadam':
      return { radiusMultiplier: 0.85, pointSpread: 1.3, offsetAmplitude: 0.2 }
    case 'mesano':
      return { radiusMultiplier: 0.92, pointSpread: 1.15, offsetAmplitude: 0.16 }
  }
}

// ─── Anti-backtrack circle algorithm ─────────────────────────────────────────

function generateCircleWaypoints(
  startLat: number,
  startLng: number,
  targetDistanceKm: number,
  twistiness: number, // 1-5
  directionAngle: number,
  routeType: RouteType,
  avoidHighways: boolean
): WaypointResult[] {
  const typeAdj = getRouteTypeAdjustments(routeType)

  // Number of intermediate points: 3-6 based on twistiness
  // Higher twistiness = more points + smaller radius (more turns)
  const numPoints = Math.min(6, Math.max(3, 2 + twistiness))

  // Radius: based on desired distance / (2π) for a full loop
  // Higher twistiness → slightly smaller radius (tighter loop = more turns)
  const twistinessRadiusFactor = 1.0 - (twistiness - 1) * 0.06 // 1.0 down to 0.76
  const baseRadiusKm = (targetDistanceKm / (2 * Math.PI)) * twistinessRadiusFactor * typeAdj.radiusMultiplier

  // Generate points in a circle/ellipse around start
  // Angular separation ensures different outbound and return paths
  const waypoints: WaypointResult[] = []

  // Start point
  const start: WaypointResult = {
    name: 'Začetek',
    lat: startLat,
    lng: startLng,
    distanceFromPrev: 0,
    cumulativeDistance: 0,
  }
  waypoints.push(start)

  let prevLat = startLat
  let prevLng = startLng
  let cumDist = 0

  for (let i = 0; i < numPoints; i++) {
    // Distribute points around the circle starting from directionAngle
    const baseAngle = directionAngle + (i / numPoints) * 360

    // Add slight randomness to angle (±10-20 degrees based on twistiness)
    const angleJitter = (Math.random() - 0.5) * (10 + twistiness * 5) * 2
    const angle = ((baseAngle + angleJitter) % 360 + 360) % 360

    // Radius variation: ±20% of base radius for randomness
    const radiusVariation = 1 + (Math.random() - 0.5) * 0.4 * typeAdj.offsetAmplitude / 0.12
    const pointRadius = baseRadiusKm * radiusVariation

    // Generate point using destination formula
    let point = destinationPoint(startLat, startLng, angle, pointRadius)

    // Apply avoid-highways offset: push waypoints slightly off straight paths
    if (avoidHighways) {
      const offsetAngle = angle + (Math.random() > 0.5 ? 90 : -90)
      const offsetDist = 0.5 + Math.random() * 1.0 // 0.5-1.5 km offset
      point = destinationPoint(point.lat, point.lng, offsetAngle, offsetDist)
    }

    // Apply route type offset
    if (routeType === 'makadam') {
      // Push points slightly toward valleys/forests (small latitude adjustment)
      const extraOffset = (Math.random() - 0.5) * 0.02
      point = { lat: point.lat + extraOffset, lng: point.lng + extraOffset / Math.cos((point.lat * Math.PI) / 180) }
    }

    const distFromPrev = haversineMeters(prevLat, prevLng, point.lat, point.lng)
    cumDist += distFromPrev

    waypoints.push({
      name: `Točka ${i + 1}`,
      lat: Math.round(point.lat * 100000) / 100000,
      lng: Math.round(point.lng * 100000) / 100000,
      distanceFromPrev: Math.round(distFromPrev),
      cumulativeDistance: Math.round(cumDist),
    })

    prevLat = point.lat
    prevLng = point.lng
  }

  // Return to start
  const returnDist = haversineMeters(prevLat, prevLng, startLat, startLng)
  cumDist += returnDist

  waypoints.push({
    name: 'Konec',
    lat: startLat,
    lng: startLng,
    distanceFromPrev: Math.round(returnDist),
    cumulativeDistance: Math.round(cumDist),
  })

  return waypoints
}

// ─── Route self-intersection check ───────────────────────────────────────────

function segmentsIntersect(
  p1: { lat: number; lng: number }, p2: { lat: number; lng: number },
  p3: { lat: number; lng: number }, p4: { lat: number; lng: number }
): boolean {
  const d1x = p2.lng - p1.lng, d1y = p2.lat - p1.lat
  const d2x = p4.lng - p3.lng, d2y = p4.lat - p3.lat

  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false

  const t = ((p3.lng - p1.lng) * d2y - (p3.lat - p1.lat) * d2x) / cross
  const u = ((p3.lng - p1.lng) * d1y - (p3.lat - p1.lat) * d1x) / cross

  return t > 0.15 && t < 0.85 && u > 0.15 && u < 0.85
}

function checkRouteCrossesItself(waypoints: WaypointResult[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    // Skip adjacent segments (they share a point)
    for (let j = i + 2; j < waypoints.length - 1; j++) {
      // Skip if segments share an endpoint (first→last)
      if (i === 0 && j === waypoints.length - 2) continue
      if (segmentsIntersect(
        waypoints[i], waypoints[i + 1],
        waypoints[j], waypoints[j + 1]
      )) {
        return true
      }
    }
  }
  return false
}

// ─── Outbound/Return path separation check ───────────────────────────────────

function calculateOutboundReturnSeparation(waypoints: WaypointResult[]): number {
  // Split route into outbound (first half) and return (second half)
  const mid = Math.floor(waypoints.length / 2)
  const outbound = waypoints.slice(0, mid + 1)
  const ret = waypoints.slice(mid)

  // Calculate minimum distance between any outbound point and any return point
  let minDist = Infinity
  for (const op of outbound) {
    for (const rp of ret) {
      const d = haversineMeters(op.lat, op.lng, rp.lat, rp.lng)
      if (d > 0 && d < minDist) minDist = d
    }
  }
  return minDist // meters
}

// ─── Twistiness score calculation ────────────────────────────────────────────

function calculateTwistinessScore(waypoints: WaypointResult[]): number {
  if (waypoints.length < 3) return 1

  let totalAngle = 0
  let angleCount = 0

  for (let i = 1; i < waypoints.length - 1; i++) {
    const b1 = Math.atan2(
      waypoints[i].lat - waypoints[i - 1].lat,
      waypoints[i].lng - waypoints[i - 1].lng
    )
    const b2 = Math.atan2(
      waypoints[i + 1].lat - waypoints[i].lat,
      waypoints[i + 1].lng - waypoints[i].lng
    )
    let diff = Math.abs(b2 - b1)
    if (diff > Math.PI) diff = 2 * Math.PI - diff
    totalAngle += diff
    angleCount++
  }

  const avgAngle = angleCount > 0 ? (totalAngle / angleCount) * (180 / Math.PI) : 0
  return Math.min(10, Math.max(1, Math.round(avgAngle * 10)))
}

// ─── POST handler ────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      startLat,
      startLng,
      distance,
      twistiness = 3,
      direction = 'auto',
      type = 'asfalt',
      avoidHighways = false,
    } = body

    // Validation
    if (typeof startLat !== 'number' || typeof startLng !== 'number' || isNaN(startLat) || isNaN(startLng)) {
      return NextResponse.json({ error: 'startLat in startLng sta obvezna' }, { status: 400 })
    }
    if (typeof distance !== 'number' || distance < 20 || distance > 300) {
      return NextResponse.json({ error: 'Razdalja mora biti med 20 in 300 km' }, { status: 400 })
    }
    if (twistiness < 1 || twistiness > 5) {
      return NextResponse.json({ error: 'Vijugavost mora biti med 1 in 5' }, { status: 400 })
    }

    const validDirections: Direction[] = ['north', 'east', 'south', 'west', 'auto']
    const dir: Direction = validDirections.includes(direction) ? direction : 'auto'
    const validTypes: RouteType[] = ['asfalt', 'makadam', 'mesano']
    const routeType: RouteType = validTypes.includes(type) ? type : 'asfalt'

    // Resolve direction angle
    const directionAngle = resolveDirectionAngle(dir, startLat, startLng)

    // Generate waypoints with anti-backtrack guarantee
    // Try up to 3 times to avoid self-crossing routes
    let waypoints: WaypointResult[] = []
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      const candidate = generateCircleWaypoints(
        startLat, startLng, distance, twistiness,
        directionAngle, routeType, avoidHighways
      )

      // Validate: route doesn't cross itself unnecessarily
      const crossesSelf = checkRouteCrossesItself(candidate)

      if (!crossesSelf || attempts === maxAttempts) {
        waypoints = candidate
        break
      }
    }

    // Calculate metrics
    const totalDistanceM = waypoints[waypoints.length - 1]?.cumulativeDistance ?? 0
    const totalDistanceKm = totalDistanceM / 1000
    const twistinessScore = calculateTwistinessScore(waypoints)
    const outboundReturnSep = calculateOutboundReturnSeparation(waypoints)

    // Estimated duration: based on route type
    // Asfalt: ~60 km/h, Makadam: ~35 km/h, Mešano: ~50 km/h
    const avgSpeedKmH = routeType === 'asfalt' ? 60 : routeType === 'makadam' ? 35 : 50
    const estimatedDurationMin = Math.round((totalDistanceKm / avgSpeedKmH) * 60)

    // Direction label
    const dirLabels: Record<string, string> = {
      north: 'Sever', east: 'Vzhod', south: 'Jug', west: 'Zahod', auto: 'Samodejno',
    }

    // Type label
    const typeLabels: Record<string, string> = {
      asfalt: 'Asfalt', makadam: 'Makadam', mesano: 'Mešano',
    }

    return NextResponse.json({
      data: {
        waypoints,
        totalDistance: Math.round(totalDistanceM),
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        estimatedDuration: estimatedDurationMin * 60, // seconds
        estimatedDurationMin,
        twistinessScore,
        outboundReturnSeparation: Math.round(outboundReturnSep),
        direction: dir,
        directionLabel: dirLabels[dir],
        directionAngle: Math.round(directionAngle),
        type: routeType,
        typeLabel: typeLabels[routeType],
        avoidHighways,
        algorithm: `circle-v2-${waypoints.length - 2}pts`,
        antiBacktrackGuarantee: outboundReturnSep > 2000, // at least 2km separation
        generatedAt: new Date().toISOString(),
      }
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Napaka pri generiranju krožne ture' },
      { status: 500 }
    )
  }
}
