import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Terrain segment for off-road routing
interface TerrainSegment {
  distance: number    // meters
  elevation: number   // meters above sea level
  gradient: number    // percentage
  surface: 'dirt' | 'gravel' | 'trail' | 'forest_road'
}

// Off-road route result
interface OffRoadRouteResult {
  terrainProfile: TerrainSegment[]
  difficulty: 'easy' | 'moderate' | 'hard' | 'extreme'
  scenicScore: number  // 1-10
  geometry: [number, number][] // [lat, lng] pairs
  waypoints: { lat: number; lng: number }[]
  totalDistance: number  // meters
  totalAscent: number   // meters
  totalDescent: number  // meters
  maxElevation: number  // meters
  surfaceBreakdown: {
    dirt: number
    gravel: number
    trail: number
    forest_road: number
  }
}

// Get elevation from Open-Meteo API
async function getElevations(points: Array<{ lat: number; lng: number }>): Promise<(number | null)[]> {
  try {
    const sampled = points.length > 80
      ? points.filter((_, i) => i % Math.ceil(points.length / 80) === 0 || i === points.length - 1)
      : points

    const latStr = sampled.map(p => p.lat.toFixed(5)).join(',')
    const lngStr = sampled.map(p => p.lng.toFixed(5)).join(',')

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) return points.map(() => null)

    const data = await res.json()
    const elevations: (number | null)[] = data.elevation || []

    if (sampled.length === points.length) return elevations

    return points.map((_, idx) => {
      const sampleIdx = Math.round(idx * (sampled.length - 1) / Math.max(1, points.length - 1))
      return elevations[sampleIdx] ?? null
    })
  } catch {
    return points.map(() => null)
  }
}

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Generate a grid of candidate points between start and end.
 * Uses a rectangular grid with some randomness for terrain exploration.
 */
function generateCandidateGrid(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  gridDensity: number = 5
): Array<{ lat: number; lng: number }> {
  const candidates: Array<{ lat: number; lng: number }> = []

  // Direct distance between start and end
  const directDistKm = haversineMeters(startLat, startLng, endLat, endLng) / 1000

  // Grid spread perpendicular to the direct line, proportional to distance
  const spreadKm = Math.min(directDistKm * 0.3, 20) // max 20km spread
  const dx = endLng - startLng
  const dy = endLat - startLat
  const len = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular direction
  const perpX = len > 0 ? -dy / len : 0
  const perpY = len > 0 ? dx / len : 0

  // Generate grid points along and perpendicular to the line
  const stepsAlong = gridDensity + 2 // More steps for longer routes
  const stepsPerp = gridDensity

  for (let i = 0; i <= stepsAlong; i++) {
    const t = i / stepsAlong
    for (let j = -stepsPerp; j <= stepsPerp; j++) {
      const baseLat = startLat + dy * t
      const baseLng = startLng + dx * t

      const offsetKm = (j / stepsPerp) * spreadKm
      // Add some jitter for variety (using deterministic "random" based on position)
      const jitter = Math.sin(i * 7.3 + j * 13.7) * spreadKm * 0.05

      const lat = baseLat + (perpX * (offsetKm + jitter)) / 111
      const lng = baseLng + (perpY * (offsetKm + jitter)) / (111 * Math.cos(baseLat * Math.PI / 180))

      candidates.push({ lat, lng })
    }
  }

  return candidates
}

/**
 * Evaluate a path through candidate points based on elevation data.
 * Lower score = better path (we're minimizing cost).
 */
function evaluatePath(
  path: Array<{ lat: number; lng: number }>,
  elevations: (number | null)[],
  maxGradientPct: number,
  avoidWaterCrossings: boolean,
  preferForestRoads: boolean
): { cost: number; validGradients: boolean } {
  let cost = 0
  let validGradients = true
  let totalDist = 0

  for (let i = 1; i < path.length; i++) {
    const dist = haversineMeters(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng)
    totalDist += dist

    // Base cost: distance (prefer shorter paths)
    cost += dist

    if (elevations[i] !== null && elevations[i - 1] !== null) {
      const gradient = dist > 0 ? ((elevations[i]! - elevations[i - 1]!) / dist) * 100 : 0
      const absGradient = Math.abs(gradient)

      // Penalize steep gradients heavily
      if (absGradient > maxGradientPct) {
        cost += dist * 3 * (absGradient / maxGradientPct)
        validGradients = false
      } else if (absGradient > maxGradientPct * 0.7) {
        cost += dist * 1.5
      }

      // Penalize high elevation (avoid high mountain passes)
      if (elevations[i]! > 1500) {
        cost += dist * 2 * (elevations[i]! / 1500)
      }

      // Reward valleys (lower elevation)
      if (elevations[i]! < 800) {
        cost -= dist * 0.3
      }

      // Penalize extreme ascent/descent
      const elevDiff = Math.abs(elevations[i]! - elevations[i - 1]!)
      if (elevDiff > 100) {
        cost += dist * 0.5
      }

      // Prefer forest roads (heuristic: mid-elevation with gentle slopes)
      if (preferForestRoads && elevations[i]! > 400 && elevations[i]! < 1200 && absGradient < 8) {
        cost -= dist * 0.2
      }
    }

    // Avoid water crossings (heuristic: penalize points near known river coordinates)
    // This is a simplified heuristic - in reality would use a water body database
    if (avoidWaterCrossings) {
      // Penalize paths that cross very low elevation points (likely river valleys)
      if (elevations[i] !== null && elevations[i]! < 300) {
        cost += dist * 0.3
      }
    }
  }

  // Normalize cost by total distance
  return { cost: totalDist > 0 ? cost / totalDist : cost, validGradients }
}

/**
 * Select best waypoints from candidate grid using elevation-based scoring.
 * Uses a greedy approach with look-ahead.
 */
function selectWaypoints(
  candidates: Array<{ lat: number; lng: number }>,
  elevations: (number | null)[],
  startIdx: number,
  endIdx: number,
  maxGradientPct: number,
  avoidWaterCrossings: boolean,
  preferForestRoads: boolean,
  targetWaypointCount: number
): Array<{ lat: number; lng: number }> {
  const selected: Array<{ lat: number; lng: number }> = [candidates[startIdx]]

  const currentIdx = { value: startIdx }

  for (let step = 0; step < targetWaypointCount - 2; step++) {
    const t = (step + 1) / (targetWaypointCount - 1)
    const targetLat = candidates[startIdx].lat + (candidates[endIdx].lat - candidates[startIdx].lat) * t
    const targetLng = candidates[startIdx].lng + (candidates[endIdx].lng - candidates[startIdx].lng) * t

    // Find the best candidate near this target position
    let bestIdx = currentIdx.value + 1
    let bestCost = Infinity

    for (let i = 0; i < candidates.length; i++) {
      if (i === currentIdx.value) continue

      // Distance to target position (how close to the ideal path point)
      const distToTarget = haversineMeters(candidates[i].lat, candidates[i].lng, targetLat, targetLng)
      if (distToTarget > 15000) continue // Skip if too far from target position (15km)

      // Evaluate path segment from current to this candidate
      const pathSegment = [candidates[currentIdx.value], candidates[i]]
      const segElevations = [elevations[currentIdx.value], elevations[i]]
      const result = evaluatePath(pathSegment, segElevations, maxGradientPct, avoidWaterCrossings, preferForestRoads)

      // Total cost = path cost + distance penalty from target
      const totalCost = result.cost + distToTarget * 0.01

      if (totalCost < bestCost) {
        bestCost = totalCost
        bestIdx = i
      }
    }

    selected.push(candidates[bestIdx])
    currentIdx.value = bestIdx
  }

  selected.push(candidates[endIdx])
  return selected
}

/**
 * Classify surface type based on elevation and distance from start/end.
 * Uses heuristics since we don't have actual road surface data.
 */
function classifySurface(
  gradient: number,
  elevation: number,
  distanceFromStart: number,
  totalDistance: number,
  isNearMainRoad: boolean
): 'dirt' | 'gravel' | 'trail' | 'forest_road' {
  const absGradient = Math.abs(gradient)
  const progress = totalDistance > 0 ? distanceFromStart / totalDistance : 0

  // Near start/end: more likely gravel or forest road
  if (progress < 0.15 || progress > 0.85) {
    return isNearMainRoad ? 'gravel' : 'forest_road'
  }

  // High elevation + steep = trail
  if (elevation > 1200 && absGradient > 8) return 'trail'

  // Mid elevation + moderate gradient = forest road
  if (elevation > 600 && elevation < 1200 && absGradient < 10) return 'forest_road'

  // Steep sections = trail
  if (absGradient > 12) return 'trail'

  // Flat mid sections = dirt
  if (absGradient < 5) return 'dirt'

  // Default
  return 'gravel'
}

/**
 * Estimate overall route difficulty based on terrain profile.
 */
function estimateDifficulty(
  terrainProfile: TerrainSegment[],
  totalDistance: number
): 'easy' | 'moderate' | 'hard' | 'extreme' {
  if (terrainProfile.length === 0) return 'easy'

  const maxGrad = Math.max(...terrainProfile.map(s => Math.abs(s.gradient)))
  const avgGrad = terrainProfile.reduce((s, t) => s + Math.abs(t.gradient), 0) / terrainProfile.length
  const steepPct = terrainProfile.filter(t => Math.abs(t.gradient) > 10).length / terrainProfile.length
  const trailPct = terrainProfile.filter(t => t.surface === 'trail').length / terrainProfile.length

  const distKm = totalDistance / 1000

  let score = 0
  score += maxGrad > 20 ? 4 : maxGrad > 15 ? 3 : maxGrad > 10 ? 2 : 1
  score += avgGrad > 8 ? 3 : avgGrad > 5 ? 2 : 1
  score += steepPct > 0.3 ? 3 : steepPct > 0.15 ? 2 : 1
  score += trailPct > 0.4 ? 3 : trailPct > 0.2 ? 2 : 1
  score += distKm > 100 ? 2 : distKm > 50 ? 1 : 0

  if (score >= 12) return 'extreme'
  if (score >= 9) return 'hard'
  if (score >= 5) return 'moderate'
  return 'easy'
}

/**
 * Calculate scenic score (1-10) based on elevation variation and terrain diversity.
 */
function calculateScenicScore(
  terrainProfile: TerrainSegment[],
  maxElevation: number,
  elevationRange: number
): number {
  if (terrainProfile.length === 0) return 5

  let score = 3 // Base score

  // Elevation variation contributes to scenic value
  if (elevationRange > 500) score += 2
  else if (elevationRange > 200) score += 1

  // High max elevation = scenic views
  if (maxElevation > 1000) score += 1
  if (maxElevation > 1500) score += 1

  // Surface diversity = more interesting
  const surfaces = new Set(terrainProfile.map(t => t.surface))
  score += Math.min(2, surfaces.size - 1)

  // Gradient variation = more interesting roads
  const gradients = terrainProfile.map(t => t.gradient)
  const gradVariance = gradients.reduce((s, g) => s + Math.pow(g - gradients.reduce((a, b) => a + b, 0) / gradients.length, 2), 0) / gradients.length
  if (gradVariance > 20) score += 1

  return Math.min(10, Math.max(1, score))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { startLat, startLng, endLat, endLng, viaPoints, maxGradient = 15, avoidWaterCrossings = false, preferForestRoads = false } = body

    if (!startLat || !startLng || !endLat || !endLng) {
      return NextResponse.json({ error: 'Start and end coordinates required' }, { status: 400 })
    }

    const maxGradientPct = Math.min(25, Math.max(5, maxGradient))

    // Step 1: Generate candidate grid of points
    const allWaypoints: Array<{ lat: number; lng: number }> = [{ lat: startLat, lng: startLng }]

    // Add via points if provided
    if (viaPoints && Array.isArray(viaPoints)) {
      allWaypoints.push(...viaPoints.map((p: any) => ({ lat: p.lat, lng: p.lng })))
    }

    allWaypoints.push({ lat: endLat, lng: endLng })

    // Step 2: Generate candidates between each pair of waypoints
    let allCandidates: Array<{ lat: number; lng: number }> = []
    const segmentResults: OffRoadRouteResult[] = []

    for (let seg = 0; seg < allWaypoints.length - 1; seg++) {
      const sLat = allWaypoints[seg].lat
      const sLng = allWaypoints[seg].lng
      const eLat = allWaypoints[seg + 1].lat
      const eLng = allWaypoints[seg + 1].lng

      const segDistKm = haversineMeters(sLat, sLng, eLat, eLng) / 1000

      // Generate candidate grid
      const gridDensity = Math.max(3, Math.min(6, Math.round(segDistKm / 15)))
      const candidates = generateCandidateGrid(sLat, sLng, eLat, eLng, gridDensity)

      // Ensure start and end are in the candidates
      candidates.unshift({ lat: sLat, lng: sLng })
      candidates.push({ lat: eLat, lng: eLng })

      // Step 3: Get elevation for all candidates
      const elevations = await getElevations(candidates)

      // Step 4: Select best waypoints through the grid
      const targetWpCount = Math.max(5, Math.min(15, Math.round(segDistKm / 8)))
      const selectedWaypoints = selectWaypoints(
        candidates,
        elevations,
        0,
        candidates.length - 1,
        maxGradientPct,
        avoidWaterCrossings,
        preferForestRoads,
        targetWpCount
      )

      // Step 5: Get detailed elevation for selected waypoints
      const selectedElevations = await getElevations(selectedWaypoints)

      // Step 6: Build terrain profile
      const terrainProfile: TerrainSegment[] = []
      let cumDist = 0
      let totalAscent = 0
      let totalDescent = 0
      let maxElev = -Infinity
      let minElev = Infinity

      for (let i = 0; i < selectedWaypoints.length; i++) {
        if (i > 0) {
          const dist = haversineMeters(
            selectedWaypoints[i - 1].lat, selectedWaypoints[i - 1].lng,
            selectedWaypoints[i].lat, selectedWaypoints[i].lng
          )
          cumDist += dist

          let gradient = 0
          if (selectedElevations[i] !== null && selectedElevations[i - 1] !== null) {
            gradient = dist > 0 ? ((selectedElevations[i]! - selectedElevations[i - 1]!) / dist) * 100 : 0
            const elevDiff = selectedElevations[i]! - selectedElevations[i - 1]!
            if (elevDiff > 0) totalAscent += elevDiff
            else totalDescent += Math.abs(elevDiff)
          }

          const isNearMainRoad = i < 2 || i > selectedWaypoints.length - 3
          const surface = classifySurface(
            gradient,
            selectedElevations[i] ?? 500,
            cumDist,
            haversineMeters(sLat, sLng, eLat, eLng),
            isNearMainRoad
          )

          terrainProfile.push({
            distance: Math.round(cumDist),
            elevation: selectedElevations[i] ?? 0,
            gradient: Math.round(gradient * 10) / 10,
            surface,
          })
        } else {
          maxElev = Math.max(maxElev, selectedElevations[i] ?? 0)
          minElev = Math.min(minElev, selectedElevations[i] ?? 10000)
        }

        if (selectedElevations[i] !== null) {
          maxElev = Math.max(maxElev, selectedElevations[i]!)
          minElev = Math.min(minElev, selectedElevations[i]!)
        }
      }

      const totalDist = cumDist
      if (maxElev === -Infinity) maxElev = 0
      if (minElev === Infinity) minElev = 0

      // Surface breakdown
      const surfaceBreakdown = {
        dirt: terrainProfile.filter(t => t.surface === 'dirt').length,
        gravel: terrainProfile.filter(t => t.surface === 'gravel').length,
        trail: terrainProfile.filter(t => t.surface === 'trail').length,
        forest_road: terrainProfile.filter(t => t.surface === 'forest_road').length,
      }

      const difficulty = estimateDifficulty(terrainProfile, totalDist)
      const scenicScore = calculateScenicScore(terrainProfile, maxElev, maxElev - minElev)

      // Build geometry from selected waypoints
      const geometry: [number, number][] = selectedWaypoints.map(w => [w.lat, w.lng] as [number, number])

      segmentResults.push({
        terrainProfile,
        difficulty,
        scenicScore,
        geometry,
        waypoints: selectedWaypoints,
        totalDistance: totalDist,
        totalAscent: Math.round(totalAscent),
        totalDescent: Math.round(totalDescent),
        maxElevation: Math.round(maxElev),
        surfaceBreakdown,
      })
    }

    // Merge all segment results
    const mergedResult: OffRoadRouteResult = {
      terrainProfile: segmentResults.flatMap(s => s.terrainProfile),
      difficulty: 'easy' as const,
      scenicScore: 0,
      geometry: segmentResults.flatMap(s => s.geometry),
      waypoints: segmentResults.flatMap(s => s.waypoints),
      totalDistance: segmentResults.reduce((sum, s) => sum + s.totalDistance, 0),
      totalAscent: segmentResults.reduce((sum, s) => sum + s.totalAscent, 0),
      totalDescent: segmentResults.reduce((sum, s) => sum + s.totalDescent, 0),
      maxElevation: Math.max(...segmentResults.map(s => s.maxElevation)),
      surfaceBreakdown: {
        dirt: segmentResults.reduce((sum, s) => sum + s.surfaceBreakdown.dirt, 0),
        gravel: segmentResults.reduce((sum, s) => sum + s.surfaceBreakdown.gravel, 0),
        trail: segmentResults.reduce((sum, s) => sum + s.surfaceBreakdown.trail, 0),
        forest_road: segmentResults.reduce((sum, s) => sum + s.surfaceBreakdown.forest_road, 0),
      },
    }

    // Overall difficulty is the hardest segment
    const difficultyOrder = ['easy', 'moderate', 'hard', 'extreme'] as const
    const maxDiffIdx = Math.max(...segmentResults.map(s => difficultyOrder.indexOf(s.difficulty as any)))
    mergedResult.difficulty = difficultyOrder[maxDiffIdx]

    // Average scenic score
    mergedResult.scenicScore = Math.round(
      segmentResults.reduce((sum, s) => sum + s.scenicScore, 0) / segmentResults.length
    )

    // Deduplicate waypoints (remove consecutive duplicates at segment boundaries)
    const dedupedWaypoints: typeof mergedResult.waypoints = [mergedResult.waypoints[0]]
    for (let i = 1; i < mergedResult.waypoints.length; i++) {
      const prev = mergedResult.waypoints[i - 1]
      const curr = mergedResult.waypoints[i]
      if (Math.abs(curr.lat - prev.lat) > 0.0001 || Math.abs(curr.lng - prev.lng) > 0.0001) {
        dedupedWaypoints.push(curr)
      }
    }
    mergedResult.waypoints = dedupedWaypoints

    return NextResponse.json({
      data: mergedResult,
    })
  } catch (err: any) {
    console.error('Off-road route error:', err)
    return NextResponse.json({ error: err.message || 'Off-road routing failed' }, { status: 500 })
  }
}
