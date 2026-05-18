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

type TerrainType = 'mixed' | 'mountain' | 'coastal' | 'forest'

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

// Calculate a point given start, bearing, and distance
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

// Calculate bearing between two points
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Calculate distance between two points in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calculate twisty score from route geometry
function calculateTwistyScore(coords: number[][]): number {
  if (coords.length < 3) return 1

  let totalAngle = 0
  let angleCount = 0

  for (let i = 2; i < coords.length; i++) {
    const b1 = Math.atan2(coords[i - 1][0] - coords[i - 2][0], coords[i - 1][1] - coords[i - 2][1])
    const b2 = Math.atan2(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    let diff = Math.abs(b2 - b1)
    if (diff > Math.PI) diff = 2 * Math.PI - diff
    totalAngle += diff
    angleCount++
  }

  const avgAngle = angleCount > 0 ? (totalAngle / angleCount) * (180 / Math.PI) : 0
  return Math.min(10, Math.max(1, Math.round(avgAngle * 15)))
}

// Calculate fuel estimate
function calculateFuelEstimate(totalDistanceMeters: number, consumptionPer100km: number = 5, tankCapacity: number = 15) {
  const distanceKm = totalDistanceMeters / 1000
  const litersNeeded = (distanceKm * consumptionPer100km) / 100
  const maxRange = (tankCapacity / consumptionPer100km) * 100 // km
  const rangeRemaining = maxRange - distanceKm
  return {
    litersNeeded: Math.round(litersNeeded * 10) / 10,
    consumptionPer100km,
    tankCapacity,
    rangeOk: rangeRemaining >= 0,
    rangeRemaining: Math.round(rangeRemaining),
  }
}

// Get terrain-specific waypoint adjustments
function getTerrainOffset(terrain: TerrainType): { latOffset: number; lngOffset: number; segmentFactor: number } {
  switch (terrain) {
    case 'mountain':
      // Push waypoints to higher latitudes (north = mountains in Balkans)
      return { latOffset: 0.08, lngOffset: 0, segmentFactor: 0.9 }
    case 'coastal':
      // Push waypoints to lower latitudes (south = coast in Balkans)
      return { latOffset: -0.08, lngOffset: 0, segmentFactor: 1.1 }
    case 'forest':
      // Slight random offset with longer segments (forest roads between settlements)
      return { latOffset: (Math.random() - 0.5) * 0.06, lngOffset: (Math.random() - 0.5) * 0.06, segmentFactor: 1.15 }
    case 'mixed':
    default:
      return { latOffset: 0, lngOffset: 0, segmentFactor: 1.0 }
  }
}

// Apply terrain adjustment to a waypoint
function applyTerrainAdjustment(point: { lat: number; lng: number }, terrain: TerrainType): { lat: number; lng: number } {
  const offset = getTerrainOffset(terrain)
  return {
    lat: point.lat + offset.latOffset,
    lng: point.lng + offset.lngOffset,
  }
}

// Check if a waypoint is likely near a highway (straight-line heuristic)
// Highways tend to be straight, so add small random offset to avoid them
function applyAvoidHighwaysOffset(point: { lat: number; lng: number }, avoidHighways: boolean): { lat: number; lng: number } {
  if (!avoidHighways) return point
  // Add a small random offset (~500m-1km) to push waypoints off straight highway paths
  const latOff = (Math.random() - 0.5) * 0.02  // ~1km
  const lngOff = (Math.random() - 0.5) * 0.02
  return {
    lat: point.lat + latOff,
    lng: point.lng + lngOff,
  }
}

// Generate perpendicular offset waypoints for "avoid same road" return path
function generateReturnWaypoints(
  midPoint: { lat: number; lng: number },
  start: { lat: number; lng: number },
  curviness: number,
  terrain: TerrainType,
  avoidHighways: boolean
): { lat: number; lng: number }[] {
  // Calculate bearing from midPoint back to start
  const returnBearing = bearing(midPoint.lat, midPoint.lng, start.lat, start.lng)
  // Perpendicular bearings (90° left and right of return direction)
  const perpLeft = (returnBearing + 270) % 360
  const perpRight = (returnBearing + 90) % 360
  // Pick one side randomly
  const perpBearing = Math.random() > 0.5 ? perpLeft : perpRight

  // Offset distance proportional to curviness (more curvy = wider offset = different roads)
  const offsetKm = curviness >= 4 ? 12 + Math.random() * 8 : curviness >= 3 ? 8 + Math.random() * 6 : 5 + Math.random() * 4

  // Total distance from midPoint to start
  const totalDist = haversineKm(midPoint.lat, midPoint.lng, start.lat, start.lng)

  // Generate 2 intermediate waypoints for the return path
  const wp1Dist = totalDist * 0.33
  const wp2Dist = totalDist * 0.66

  // Point along the direct return line at 33%
  const p1direct = destinationPoint(midPoint.lat, midPoint.lng, returnBearing, wp1Dist)
  // Point along the direct return line at 66%
  const p2direct = destinationPoint(midPoint.lat, midPoint.lng, returnBearing, wp2Dist)

  // Offset these points perpendicular to the return line
  // Use different offsets for wp1 and wp2 to create a non-trivial path
  const wp1 = destinationPoint(p1direct.lat, p1direct.lng, perpBearing, offsetKm)
  const wp2 = destinationPoint(p2direct.lat, p2direct.lng, perpBearing, offsetKm * 0.7)

  // Apply terrain adjustments
  const wp1adj = applyTerrainAdjustment(wp1, terrain)
  const wp2adj = applyTerrainAdjustment(wp2, terrain)

  // Apply avoid-highways offset
  const wp1final = applyAvoidHighwaysOffset(wp1adj, avoidHighways)
  const wp2final = applyAvoidHighwaysOffset(wp2adj, avoidHighways)

  return [wp1final, wp2final]
}

// Compute segment distances from OSRM route legs
function computeSegmentDistances(
  routeLegs: Array<{ distance: number }>,
  waypointLabels: string[]
): Array<{ fromLabel: string; toLabel: string; distanceMeters: number }> {
  const segments: Array<{ fromLabel: string; toLabel: string; distanceMeters: number }> = []
  const numLegs = Math.min(routeLegs.length, waypointLabels.length - 1)
  for (let i = 0; i < numLegs; i++) {
    segments.push({
      fromLabel: waypointLabels[i],
      toLabel: waypointLabels[i + 1],
      distanceMeters: Math.round(routeLegs[i].distance),
    })
  }
  return segments
}

async function generateRoundTrip(
  startLat: number,
  startLng: number,
  distance: number,
  direction: string | number | undefined,
  curviness: number = 3,
  avoidSameRoad: boolean = true,
  terrain: TerrainType = 'mixed',
  avoidHighways: boolean = false
) {
  const dirDeg = resolveDirection(direction)

  if (avoidSameRoad) {
    return await generateAvoidSameRoadRoute(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
  }

  // Standard multi-waypoint loop (existing algorithm, enhanced with terrain + avoidHighways)
  return await generateMultiWaypointLoop(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
}

// AVOID SAME ROAD algorithm: outbound path + return path via different waypoints
async function generateAvoidSameRoadRoute(
  startLat: number,
  startLng: number,
  distance: number,
  dirDeg: number,
  curviness: number,
  terrain: TerrainType,
  avoidHighways: boolean
) {
  // Phase 1: Generate outbound waypoints (Start → MidPoint)
  const outboundDist = distance * 0.5
  const numOutboundPts = curviness >= 4 ? 2 : 1
  const spreadAngle = curviness >= 4 ? 30 : 20
  const terrainAdj = getTerrainOffset(terrain)

  const outboundWaypoints: { lat: number; lng: number }[] = [{ lat: startLat, lng: startLng }]

  for (let i = 0; i < numOutboundPts; i++) {
    const fraction = (i + 1) / (numOutboundPts + 1)
    const loopAngle = dirDeg + spreadAngle * Math.sin(fraction * 2 * Math.PI)
    const pointDist = (outboundDist / (numOutboundPts + 1)) * (0.8 + Math.random() * 0.4)

    const prevPoint = outboundWaypoints[outboundWaypoints.length - 1]
    let nextPoint = destinationPoint(prevPoint.lat, prevPoint.lng, loopAngle, pointDist)

    // Apply terrain adjustment
    nextPoint = {
      lat: nextPoint.lat + terrainAdj.latOffset * 0.5,
      lng: nextPoint.lng + terrainAdj.lngOffset * 0.5,
    }

    // Apply avoid-highways offset
    nextPoint = applyAvoidHighwaysOffset(nextPoint, avoidHighways)

    outboundWaypoints.push(nextPoint)
  }

  // MidPoint (furthest point from start)
  const midPoint = destinationPoint(startLat, startLng, dirDeg, outboundDist)
  const midPointAdj = applyTerrainAdjustment(midPoint, terrain)
  outboundWaypoints.push(midPointAdj)

  // Phase 2: Generate return waypoints (MidPoint → Start via different path)
  const returnWaypoints = generateReturnWaypoints(midPointAdj, { lat: startLat, lng: startLng }, curviness, terrain, avoidHighways)

  // Combine: Start → outbound waypoints → MidPoint → return waypoints → Start
  const allWaypoints = [
    ...outboundWaypoints,
    ...returnWaypoints,
    { lat: startLat, lng: startLng },
  ]

  // Labels for segments
  const waypointLabels = allWaypoints.map((_, i) => {
    if (i === 0) return 'Začetek'
    if (i === allWaypoints.length - 1) return 'Konec'
    if (i === outboundWaypoints.length - 1) return 'Polovica'
    return `Točka ${String.fromCharCode(65 + i - 1)}`
  })

  // Build OSRM URL with all waypoints
  const coords = allWaypoints.map(w => `${w.lng},${w.lat}`).join(';')
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`

  try {
    const loopRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(20000) })
    if (!loopRes.ok) {
      return await generateMultiWaypointLoop(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
    }

    const loopData = await loopRes.json()
    if (!loopData.routes?.length) {
      return await generateMultiWaypointLoop(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
    }

    // Pick the alternative route if available (more different from direct path)
    const route = loopData.routes.length > 1 ? loopData.routes[1] : loopData.routes[0]
    const allCoords = route.geometry.coordinates
    const totalDistance = Math.round(route.distance)
    const totalDuration = Math.round(route.duration)
    const twistyScore = calculateTwistyScore(allCoords)

    // Sample waypoints for display (max ~30)
    const sampledWaypoints = allCoords
      .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
      .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

    // Compute segment distances
    const segmentDistances = route.legs
      ? computeSegmentDistances(route.legs, waypointLabels)
      : undefined

    const fuelEstimate = calculateFuelEstimate(totalDistance)

    return {
      data: {
        waypoints: sampledWaypoints,
        totalDistance,
        estimatedDuration: totalDuration,
        geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
        twistyScore,
        isLoop: true,
        loopPoints: allWaypoints.slice(1, -1).map((w, i) => ({
          label: waypointLabels[i + 1],
          lat: w.lat,
          lng: w.lng,
        })),
        algorithm: `avoid-same-road-${allWaypoints.length}pts`,
        avoidSameRoad: true,
        terrain,
        fuelEstimate,
        segmentDistances,
      }
    }
  } catch {
    return await generateMultiWaypointLoop(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
  }
}

// Standard multi-waypoint loop (enhanced with terrain + avoidHighways)
async function generateMultiWaypointLoop(
  startLat: number,
  startLng: number,
  distance: number,
  dirDeg: number,
  curviness: number,
  terrain: TerrainType,
  avoidHighways: boolean
) {
  const numIntermediatePoints = curviness >= 4 ? 4 : curviness >= 3 ? 3 : 2
  const spreadAngle = curviness >= 4 ? 40 : curviness >= 3 ? 30 : 20
  const terrainAdj = getTerrainOffset(terrain)

  const segmentDist = distance / (numIntermediatePoints + 1)

  const waypoints: { lat: number; lng: number }[] = [{ lat: startLat, lng: startLng }]
  const waypointLabels: string[] = ['Začetek']

  for (let i = 0; i < numIntermediatePoints; i++) {
    const fraction = (i + 1) / (numIntermediatePoints + 1)
    const loopAngle = dirDeg + spreadAngle * Math.sin(fraction * 2 * Math.PI * (curviness >= 4 ? 1.5 : 1))
    const pointDist = segmentDist * (0.8 + Math.random() * 0.4) * terrainAdj.segmentFactor

    const prevPoint = waypoints[waypoints.length - 1]
    let nextPoint = destinationPoint(prevPoint.lat, prevPoint.lng, loopAngle, pointDist)

    // Apply terrain adjustment
    nextPoint = {
      lat: nextPoint.lat + terrainAdj.latOffset * 0.3,
      lng: nextPoint.lng + terrainAdj.lngOffset * 0.3,
    }

    // Apply avoid-highways offset
    nextPoint = applyAvoidHighwaysOffset(nextPoint, avoidHighways)

    waypoints.push(nextPoint)
    waypointLabels.push(`Točka ${String.fromCharCode(65 + i)}`)
  }

  // Close the loop back to start
  waypoints.push({ lat: startLat, lng: startLng })
  waypointLabels.push('Konec')

  // Build OSRM URL with all waypoints
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

  try {
    const loopRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(15000) })
    if (!loopRes.ok) {
      return await generateSimpleTriangleRoute(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
    }

    const loopData = await loopRes.json()
    if (!loopData.routes?.length) {
      return await generateSimpleTriangleRoute(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
    }

    const route = loopData.routes[0]
    const allCoords = route.geometry.coordinates
    const totalDistance = Math.round(route.distance)
    const totalDuration = Math.round(route.duration)
    const twistyScore = calculateTwistyScore(allCoords)

    // Sample waypoints for display (max ~30)
    const sampledWaypoints = allCoords
      .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
      .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

    const segmentDistances = route.legs
      ? computeSegmentDistances(route.legs, waypointLabels)
      : undefined

    const fuelEstimate = calculateFuelEstimate(totalDistance)

    return {
      data: {
        waypoints: sampledWaypoints,
        totalDistance,
        estimatedDuration: totalDuration,
        geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
        twistyScore,
        isLoop: true,
        loopPoints: waypoints.slice(1, -1).map((w, i) => ({
          label: waypointLabels[i + 1],
          lat: w.lat,
          lng: w.lng,
        })),
        algorithm: `multi-waypoint-loop-${numIntermediatePoints}pts`,
        avoidSameRoad: false,
        terrain,
        fuelEstimate,
        segmentDistances,
      }
    }
  } catch {
    return await generateSimpleTriangleRoute(startLat, startLng, distance, dirDeg, curviness, terrain, avoidHighways)
  }
}

// Fallback: Simple triangular route (original algorithm, enhanced)
async function generateSimpleTriangleRoute(
  startLat: number,
  startLng: number,
  distance: number,
  dirDeg: number,
  curviness: number,
  terrain: TerrainType = 'mixed',
  avoidHighways: boolean = false
) {
  const R = 6371
  const dirRad = (dirDeg * Math.PI) / 180
  const lat1 = (startLat * Math.PI) / 180
  const lng1 = (startLng * Math.PI) / 180
  const terrainAdj = getTerrainOffset(terrain)

  // Point A: ~45% of distance in chosen direction
  const distA = (distance * 0.45) / R
  const latA = Math.asin(Math.sin(lat1) * Math.cos(distA) + Math.cos(lat1) * Math.sin(distA) * Math.cos(dirRad))
  const lngA = lng1 + Math.atan2(
    Math.sin(dirRad) * Math.sin(distA) * Math.cos(lat1),
    Math.cos(distA) - Math.sin(lat1) * Math.sin(latA)
  )
  let pointALat = (latA * 180) / Math.PI + terrainAdj.latOffset * 0.3
  let pointALng = (lngA * 180) / Math.PI + terrainAdj.lngOffset * 0.3

  // Apply avoid-highways offset
  const pointAAdj = applyAvoidHighwaysOffset({ lat: pointALat, lng: pointALng }, avoidHighways)
  pointALat = pointAAdj.lat
  pointALng = pointAAdj.lng

  // Point B: ~45% of distance in direction + offset angle (creates triangular loop)
  const offsetAngle = curviness >= 4 ? 100 : curviness >= 3 ? 80 : 60
  const dirBRad = ((dirDeg + offsetAngle) * Math.PI) / 180
  const distB = (distance * 0.45) / R
  const latB = Math.asin(Math.sin(lat1) * Math.cos(distB) + Math.cos(lat1) * Math.sin(distB) * Math.cos(dirBRad))
  const lngB = lng1 + Math.atan2(
    Math.sin(dirBRad) * Math.sin(distB) * Math.cos(lat1),
    Math.cos(distB) - Math.sin(lat1) * Math.sin(latB)
  )
  let pointBLat = (latB * 180) / Math.PI + terrainAdj.latOffset * 0.3
  let pointBLng = (lngB * 180) / Math.PI + terrainAdj.lngOffset * 0.3

  const pointBAdj = applyAvoidHighwaysOffset({ lat: pointBLat, lng: pointBLng }, avoidHighways)
  pointBLat = pointBAdj.lat
  pointBLng = pointBAdj.lng

  // Route: Start → Point A → Point B → Start (triangular loop)
  const loopCoords = `${startLng},${startLat};${pointALng},${pointALat};${pointBLng},${pointBLat};${startLng},${startLat}`
  const waypointLabels = ['Začetek', 'Točka A', 'Točka B', 'Konec']
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
    const twistyScore = calculateTwistyScore(allCoords)
    const waypoints = allCoords
      .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
      .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

    const fuelEstimate = calculateFuelEstimate(totalDistance)

    return {
      data: {
        waypoints,
        totalDistance,
        estimatedDuration: totalDuration,
        geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
        twistyScore,
        isLoop: false,
        avoidSameRoad: false,
        terrain,
        fuelEstimate,
      }
    }
  }

  const loopData = await loopRes.json()
  if (!loopData.routes?.length) return { error: 'No route found', status: 404 }

  const route = loopData.routes[0]
  const allCoords = route.geometry.coordinates
  const totalDistance = Math.round(route.distance)
  const totalDuration = Math.round(route.duration)
  const twistyScore = calculateTwistyScore(allCoords)

  // Sample waypoints for display (max ~30)
  const waypoints = allCoords
    .filter((_: number[], i: number) => i % Math.max(1, Math.floor(allCoords.length / 30)) === 0 || i === allCoords.length - 1)
    .map((c: number[]) => ({ lat: c[1], lng: c[0] }))

  const segmentDistances = route.legs
    ? computeSegmentDistances(route.legs, waypointLabels)
    : undefined

  const fuelEstimate = calculateFuelEstimate(totalDistance)

  return {
    data: {
      waypoints,
      totalDistance,
      estimatedDuration: totalDuration,
      geometry: allCoords.map((c: number[]) => [c[1], c[0]] as [number, number]),
      twistyScore,
      isLoop: true,
      loopPoints: { a: { lat: pointALat, lng: pointALng }, b: { lat: pointBLat, lng: pointBLng } },
      algorithm: 'triangle-loop',
      avoidSameRoad: false,
      terrain,
      fuelEstimate,
      segmentDistances,
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
    const avoidSameRoad = searchParams.get('avoidSameRoad') !== 'false' // default: true
    const terrainParam = searchParams.get('terrain') || 'mixed'
    const terrain: TerrainType = ['mixed', 'mountain', 'coastal', 'forest'].includes(terrainParam) ? terrainParam as TerrainType : 'mixed'
    const avoidHighways = searchParams.get('avoidHighways') === 'true' // default: false

    if (isNaN(startLat) || isNaN(startLng) || isNaN(distance)) {
      return NextResponse.json({ error: 'startLat, startLng, distance required' }, { status: 400 })
    }

    const result = await generateRoundTrip(startLat, startLng, distance, direction, curviness, avoidSameRoad, terrain, avoidHighways)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Round trip failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { startLat, startLng, distance, direction, curviness = 3, avoidSameRoad = true, terrain: terrainParam = 'mixed', avoidHighways = false } = body
    if (!startLat || !startLng || !distance) {
      return NextResponse.json({ error: 'startLat, startLng, distance required' }, { status: 400 })
    }

    const terrain: TerrainType = ['mixed', 'mountain', 'coastal', 'forest'].includes(terrainParam) ? terrainParam as TerrainType : 'mixed'

    const result = await generateRoundTrip(startLat, startLng, distance, direction, curviness, avoidSameRoad, terrain, avoidHighways)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Round trip failed' }, { status: 500 })
  }
}
