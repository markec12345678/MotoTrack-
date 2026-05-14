import { NextRequest, NextResponse } from 'next/server'

const TURN_SLOVENIAN: Record<string, string> = {
  'turn': 'Zavij',
  'new name': 'Nadaljuj',
  'depart': 'Kreni',
  'arrive': 'Prispeli ste',
  'merge': 'Združi se',
  'fork': 'Na razcepu',
  'roundabout': 'Krožišče',
  'rotary': 'Krožišče',
  'continue': 'Nadaljuj naravnost',
}

const MODIFIER_SLOVENIAN: Record<string, string> = {
  'left': 'levo',
  'right': 'desno',
  'slight left': 'rahlo levo',
  'slight right': 'rahlo desno',
  'sharp left': 'ostro levo',
  'sharp right': 'ostro desno',
  'straight': 'naravnost',
  'uturn': 'polkrožni obrat',
}

function translateInstruction(type: string, modifier?: string, name?: string): string {
  if (type === 'arrive') return '📍 Prispeli ste na cilj'
  if (type === 'roundabout' || type === 'rotary') {
    return `🔄 Krožišče${name ? ` - ${name}` : ''}`
  }
  const turnWord = TURN_SLOVENIAN[type] || 'Nadaljuj'
  const mod = modifier ? MODIFIER_SLOVENIAN[modifier] || modifier : ''
  const roadName = name && name !== '' ? ` na ${name}` : ''
  if (mod) return `${turnWord} ${mod}${roadName}`
  return `${turnWord}${roadName}`
}

/**
 * Douglas-Peucker algorithm to simplify a polyline.
 * Returns indices of the points to keep.
 */
function douglasPeuckerIndices(
  points: { lat: number; lng: number }[],
  epsilon: number
): number[] {
  if (points.length <= 2) return [0, points.length - 1]

  // Find the point with the maximum distance from the line between first and last
  let maxDist = 0
  let maxIdx = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeuckerIndices(points.slice(0, maxIdx + 1), epsilon)
    const right = douglasPeuckerIndices(points.slice(maxIdx), epsilon)
    // Merge, avoiding duplicate at the split point
    return [...left.slice(0, -1), ...right.map(i => i + maxIdx)]
  }

  return [0, points.length - 1]
}

/**
 * Calculate perpendicular distance from point p to line segment (a, b)
 * in approximate meters (using lat/lng directly as a rough approximation)
 */
function perpendicularDistance(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dx = b.lng - a.lng
  const dy = b.lat - a.lat
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    // a and b are the same point
    const dlat = p.lat - a.lat
    const dlng = p.lng - a.lng
    return Math.sqrt(dlat * dlat + dlng * dlng) * 111000 // rough meters
  }

  // Area of triangle * 2 / base length = height (perpendicular distance)
  const area = Math.abs((b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng))
  const baseLen = Math.sqrt(lenSq) * 111000 // rough meters
  return (area / baseLen) * 111000
}

/**
 * Simplify waypoints to a maximum count, keeping start and end.
 * Uses Douglas-Peucker first, then uniform sampling as fallback.
 */
function simplifyWaypoints(
  waypoints: { lat: number; lng: number }[],
  maxCount: number
): { lat: number; lng: number }[] {
  if (waypoints.length <= maxCount) return waypoints

  // Try Douglas-Peucker with increasing epsilon until we get <= maxCount
  let epsilon = 5 // meters
  let result: { lat: number; lng: number }[] = waypoints

  for (let attempt = 0; attempt < 20; attempt++) {
    const indices = douglasPeuckerIndices(waypoints, epsilon)
    const simplified = indices.map(i => waypoints[i])
    if (simplified.length <= maxCount) {
      result = simplified
      break
    }
    epsilon *= 2
  }

  // Fallback: if Douglas-Peucker didn't reduce enough, use uniform sampling
  if (result.length > maxCount) {
    const keep: { lat: number; lng: number }[] = [waypoints[0]] // always keep start
    const step = (waypoints.length - 1) / (maxCount - 1)
    for (let i = 1; i < maxCount - 1; i++) {
      const idx = Math.round(i * step)
      keep.push(waypoints[idx])
    }
    keep.push(waypoints[waypoints.length - 1]) // always keep end
    result = keep
  }

  return result
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const waypointsParam = searchParams.get('waypoints')
    if (!waypointsParam) return NextResponse.json({ error: 'waypoints required' }, { status: 400 })

    const maxWaypoints = Math.min(Math.max(parseInt(searchParams.get('maxWaypoints') || '25', 10), 2), 25)

    const waypoints = JSON.parse(waypointsParam)
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 waypoints' }, { status: 400 })
    }

    // Simplify waypoints if they exceed the limit
    const simplified = waypoints.length > maxWaypoints
      ? simplifyWaypoints(waypoints, maxWaypoints)
      : waypoints

    const coords = simplified.map((w: { lat: number; lng: number }) => `${w.lng},${w.lat}`).join(';')
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&steps=true&geometries=geojson`

    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) })
    if (!osrmRes.ok) return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })

    const osrmData = await osrmRes.json()
    if (!osrmData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    const route = osrmData.routes[0]
    const steps = route.legs.flatMap((leg: any) =>
      leg.steps.map((step: any) => ({
        instruction: translateInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
        type: step.maneuver.type,
        modifier: step.maneuver.modifier || null,
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        name: step.name || '',
        lat: step.maneuver.location[1],
        lng: step.maneuver.location[0],
        coords: [step.maneuver.location[0], step.maneuver.location[1]] as [number, number],
      }))
    )

    const geometry: [number, number][] = route.geometry.coordinates.map(
      (c: number[]) => [c[1], c[0]] as [number, number]
    )

    return NextResponse.json({
      data: {
        steps,
        totalDistance: Math.round(route.distance),
        totalDuration: Math.round(route.duration),
        geometry,
        simplified: waypoints.length > maxWaypoints,
        originalWaypointCount: waypoints.length,
        usedWaypointCount: simplified.length,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Navigation failed' }, { status: 500 })
  }
}
