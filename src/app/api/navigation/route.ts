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
  'on ramp': 'Priključek',
  'off ramp': 'Odhod',
  'end of road': 'Konec ceste',
  'notification': 'Obvestilo',
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
  if (type === 'on ramp') return `🛣️ Priključek${modifier ? ` ${MODIFIER_SLOVENIAN[modifier] || modifier}` : ''}${name ? ` - ${name}` : ''}`
  if (type === 'off ramp') return `🚗 Odhod${modifier ? ` ${MODIFIER_SLOVENIAN[modifier] || modifier}` : ''}${name ? ` - ${name}` : ''}`
  if (type === 'end of road') return `🛑 Konec ceste${modifier ? ` - zavij ${MODIFIER_SLOVENIAN[modifier] || modifier}` : ''}${name ? ` na ${name}` : ''}`
  if (type === 'notification') return `ℹ️ Obvestilo${name ? ` - ${name}` : ''}`

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
 * Uses Douglas-Peucker first, then prioritizes waypoints near turns/intersections.
 * Steps with type !== 'new name' and type !== 'depart' are considered important turn points.
 */
function simplifyWaypoints(
  waypoints: { lat: number; lng: number }[],
  maxCount: number,
  importantIndices?: Set<number>
): { lat: number; lng: number }[] {
  if (waypoints.length <= maxCount) return waypoints

  // Try Douglas-Peucker with increasing epsilon until we get <= maxCount
  let epsilon = 5 // meters
  let dpIndices: number[] = []

  for (let attempt = 0; attempt < 20; attempt++) {
    const indices = douglasPeuckerIndices(waypoints, epsilon)
    if (indices.length <= maxCount) {
      dpIndices = indices
      break
    }
    epsilon *= 2
  }

  // If Douglas-Peucker found a solution, check if we need to incorporate important waypoints
  if (dpIndices.length > 0 && dpIndices.length <= maxCount && importantIndices && importantIndices.size > 0) {
    const dpSet = new Set(dpIndices)

    // Find important indices not yet included
    const missingImportant = Array.from(importantIndices).filter(i => !dpSet.has(i) && i >= 0 && i < waypoints.length)

    if (missingImportant.length > 0) {
      // We have room to add important waypoints
      const availableSlots = maxCount - dpIndices.length

      // Sort missing important waypoints by priority (we'll add as many as we can)
      const toAdd = missingImportant.slice(0, availableSlots)

      if (toAdd.length > 0) {
        // Merge and re-sort indices
        const merged = [...dpIndices, ...toAdd].sort((a, b) => a - b)
        // Remove duplicates
        const unique = [...new Set(merged)]
        dpIndices = unique.slice(0, maxCount)
      }
    }

    // If still too many, remove least important non-essential points
    if (dpIndices.length > maxCount) {
      // Always keep first and last
      const first = dpIndices[0]
      const last = dpIndices[dpIndices.length - 1]
      const middle = dpIndices.slice(1, -1)

      // Prioritize: keep important indices, then Douglas-Peucker points
      const sortedMiddle = middle.sort((a, b) => {
        const aImportant = importantIndices.has(a) ? 1 : 0
        const bImportant = importantIndices.has(b) ? 1 : 0
        return bImportant - aImportant // Important ones first
      })

      dpIndices = [first, ...sortedMiddle.slice(0, maxCount - 2), last].sort((a, b) => a - b)
    }

    return dpIndices.map(i => waypoints[i])
  }

  // Fallback: if Douglas-Peucker didn't reduce enough, use importance-aware sampling
  if (dpIndices.length > maxCount || dpIndices.length === 0) {
    const keep: { lat: number; lng: number }[] = [waypoints[0]] // always keep start

    if (importantIndices && importantIndices.size > 0) {
      // First, add all important waypoints that fit
      const importantSorted = Array.from(importantIndices)
        .filter(i => i > 0 && i < waypoints.length - 1)
        .sort((a, b) => a - b)

      const slotsForImportant = Math.min(importantSorted.length, maxCount - 2)
      const slotsForUniform = maxCount - 2 - slotsForImportant

      // Add important waypoints
      for (let i = 0; i < slotsForImportant; i++) {
        keep.push(waypoints[importantSorted[i]])
      }

      // Fill remaining slots with uniform sampling from non-important points
      if (slotsForUniform > 0) {
        const nonImportantIndices: number[] = []
        for (let i = 1; i < waypoints.length - 1; i++) {
          if (!importantIndices.has(i)) nonImportantIndices.push(i)
        }
        const step = nonImportantIndices.length > 0 ? Math.floor(nonImportantIndices.length / (slotsForUniform + 1)) : 1
        for (let i = 0; i < slotsForUniform && i * step + step < nonImportantIndices.length; i++) {
          keep.push(waypoints[nonImportantIndices[Math.min((i + 1) * step, nonImportantIndices.length - 1)]])
        }
      }
    } else {
      // No important indices info, use uniform sampling
      const step = (waypoints.length - 1) / (maxCount - 1)
      for (let i = 1; i < maxCount - 1; i++) {
        const idx = Math.round(i * step)
        keep.push(waypoints[idx])
      }
    }

    keep.push(waypoints[waypoints.length - 1]) // always keep end
    return keep
  }

  return dpIndices.map(i => waypoints[i])
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
    const wasSimplified = waypoints.length > maxWaypoints
    const simplified = wasSimplified
      ? simplifyWaypoints(waypoints, maxWaypoints)
      : waypoints

    const coords = simplified.map((w: { lat: number; lng: number }) => `${w.lng},${w.lat}`).join(';')
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&steps=true&geometries=geojson`

    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) })
    if (!osrmRes.ok) return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })

    const osrmData = await osrmRes.json()
    if (!osrmData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    const route = osrmData.routes[0]
    const steps = route.legs.flatMap((leg: { steps: Array<{ maneuver: { type: string; modifier?: string; location: [number, number] }; name?: string; distance: number; duration: number }> }) =>
      leg.steps.map((step) => ({
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

    // If simplified, re-run simplification with turn-aware importance
    let finalSimplified = wasSimplified
    let finalOriginalCount = waypoints.length
    let finalUsedCount = simplified.length

    if (wasSimplified && steps.length > 0) {
      // Build set of important waypoint indices (turns/intersections)
      // Steps with type not 'new name' and not 'depart' are important
      const importantStepTypes = new Set<string>()
      for (const step of steps) {
        if (step.type !== 'new name' && step.type !== 'depart') {
          importantStepTypes.add(step.type)
        }
      }

      // Find which original waypoint indices correspond to important steps
      const importantIndices = new Set<number>()
      for (const step of steps) {
        // Find the closest original waypoint to this step's location
        let minDist = Infinity
        let minIdx = 0
        for (let i = 0; i < waypoints.length; i++) {
          const d = Math.abs(waypoints[i].lat - step.lat) + Math.abs(waypoints[i].lng - step.lng)
          if (d < minDist) {
            minDist = d
            minIdx = i
          }
        }
        if (step.type !== 'new name' && step.type !== 'depart') {
          importantIndices.add(minIdx)
        }
      }

      // Re-simplify with important indices
      const turnAwareSimplified = simplifyWaypoints(waypoints, maxWaypoints, importantIndices)
      finalUsedCount = turnAwareSimplified.length

      // Check if turn-aware simplification is different from basic
      const basicSet = new Set(simplified.map((w: { lat: number; lng: number }) => `${w.lat},${w.lng}`))
      const turnAwareSet = new Set(turnAwareSimplified.map((w: { lat: number; lng: number }) => `${w.lat},${w.lng}`))
      const isDifferent = turnAwareSet.size !== basicSet.size ||
        [...turnAwareSet].some(k => !basicSet.has(k))

      if (isDifferent) {
        // Re-route with turn-aware waypoints
        const turnAwareCoords = turnAwareSimplified.map((w: { lat: number; lng: number }) => `${w.lng},${w.lat}`).join(';')
        const turnAwareUrl = `https://router.project-osrm.org/route/v1/driving/${turnAwareCoords}?overview=full&steps=true&geometries=geojson`

        try {
          const turnAwareRes = await fetch(turnAwareUrl, { signal: AbortSignal.timeout(10000) })
          if (turnAwareRes.ok) {
            const turnAwareData = await turnAwareRes.json()
            if (turnAwareData.routes?.length) {
              const turnAwareRoute = turnAwareData.routes[0]
              const turnAwareSteps = turnAwareRoute.legs.flatMap((leg: { steps: Array<{ maneuver: { type: string; modifier?: string; location: [number, number] }; name?: string; distance: number; duration: number }> }) =>
                leg.steps.map((step) => ({
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

              const turnAwareGeometry: [number, number][] = turnAwareRoute.geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]] as [number, number]
              )

              // Log simplification info
              console.log(`[Navigation] Waypoint simplification: ${finalOriginalCount} → ${finalUsedCount} (turn-aware, ${importantIndices.size} important turns preserved)`)

              return NextResponse.json({
                data: {
                  steps: turnAwareSteps,
                  totalDistance: Math.round(turnAwareRoute.distance),
                  totalDuration: Math.round(turnAwareRoute.duration),
                  geometry: turnAwareGeometry,
                  simplified: true,
                  originalWaypointCount: finalOriginalCount,
                  usedWaypointCount: finalUsedCount,
                  simplificationNote: `${finalOriginalCount - finalUsedCount} waypoints simplified (turn-aware Douglas-Peucker, ${importantIndices.size} important turns preserved)`,
                }
              })
            }
          }
        } catch {
          // Fall through to use the basic simplification result
        }
      }
    }

    // Log simplification info for basic case
    if (wasSimplified) {
      console.log(`[Navigation] Waypoint simplification: ${finalOriginalCount} → ${finalUsedCount} (Douglas-Peucker)`)
    }

    return NextResponse.json({
      data: {
        steps,
        totalDistance: Math.round(route.distance),
        totalDuration: Math.round(route.duration),
        geometry,
        simplified: wasSimplified,
        originalWaypointCount: finalOriginalCount,
        usedWaypointCount: finalUsedCount,
        simplificationNote: wasSimplified
          ? `${finalOriginalCount - finalUsedCount} waypoints simplified (Douglas-Peucker)`
          : undefined,
      }
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Navigation failed' }, { status: 500 })
  }
}
