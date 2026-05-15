import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/ai-route-planner - AI-powered motorcycle route generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startLat, startLng, duration, style, maxDistance } = body

    if (!startLat || !startLng) {
      return NextResponse.json(
        { success: false, error: 'startLat and startLng are required' },
        { status: 400 }
      )
    }

    const durationHours = duration || 3
    const rideStyle = style || 'scenic' // scenic, twisty, touring, offroad
    const maxDist = maxDistance || durationHours * 60 // ~60km/h average

    // AI Route Generation Algorithm
    // Inspired by Calimoto's Twisty Roads Algorithm and Vroom GPS
    // Generates interesting routes based on style preferences

    const seed = Date.now()
    let rngState = seed
    const seededRandom = () => {
      rngState = (rngState * 1664525 + 1013904223) & 0xffffffff
      return (rngState >>> 0) / 0xffffffff
    }

    // Calculate target radius for the route
    const targetDistanceKm = Math.min(maxDist, durationHours * 70)
    const idealRadiusKm = targetDistanceKm / (2 * Math.PI) * 1.2

    // Style-specific parameters
    const styleParams: Record<string, { numWaypoints: number; radiusVariation: number; angleJitter: number; direction: number }> = {
      scenic: {
        numWaypoints: Math.max(6, Math.round(targetDistanceKm / 30)),
        radiusVariation: 0.2,
        angleJitter: 0.1,
        direction: seededRandom() > 0.5 ? 1 : -1,
      },
      twisty: {
        numWaypoints: Math.max(10, Math.round(targetDistanceKm / 15)),
        radiusVariation: 0.35,
        angleJitter: 0.25,
        direction: seededRandom() > 0.5 ? 1 : -1,
      },
      touring: {
        numWaypoints: Math.max(5, Math.round(targetDistanceKm / 50)),
        radiusVariation: 0.15,
        angleJitter: 0.05,
        direction: seededRandom() > 0.5 ? 1 : -1,
      },
      offroad: {
        numWaypoints: Math.max(8, Math.round(targetDistanceKm / 20)),
        radiusVariation: 0.4,
        angleJitter: 0.3,
        direction: seededRandom() > 0.5 ? 1 : -1,
      },
    }

    const params = styleParams[rideStyle] || styleParams.scenic

    // Known interesting waypoints near Balkan coordinates to bias route toward
    const interestingPoints = [
      { lat: 46.4333, lng: 13.7333, name: 'Vršič', weight: 2 },   // Slovenia passes
      { lat: 46.15, lng: 13.6, name: 'Soška dolina', weight: 1.5 },
      { lat: 45.8, lng: 15.17, name: 'Gorjanci', weight: 1.2 },
      { lat: 45.32, lng: 14.45, name: 'Jadran HR', weight: 1.3 },
      { lat: 42.42, lng: 18.77, name: 'Kotor', weight: 2 },
      { lat: 43.3, lng: 18.8, name: 'Piva ME', weight: 1.5 },
      { lat: 45.59, lng: 24.62, name: 'Transfăgărășan', weight: 2 },
      { lat: 45.6, lng: 23.6, name: 'Transalpina', weight: 2 },
    ]

    // Find nearby interesting points to bias the route
    const nearbyPoints = interestingPoints
      .map(p => ({
        ...p,
        distance: Math.sqrt(
          Math.pow((p.lat - startLat) * 111, 2) +
          Math.pow((p.lng - startLng) * 111 * Math.cos(startLat * Math.PI / 180), 2)
        ),
      }))
      .filter(p => p.distance < idealRadiusKm * 2)
      .sort((a, b) => a.distance - b.distance)

    // Generate waypoints
    const waypoints: Array<{ lat: number; lng: number; name?: string }> = []
    waypoints.push({ lat: startLat, lng: startLng, name: 'Start' })

    for (let i = 1; i < params.numWaypoints; i++) {
      const baseAngle = (i / params.numWaypoints) * 2 * Math.PI * params.direction

      // Add angular jitter
      const jitteredAngle = baseAngle + (seededRandom() - 0.5) * params.angleJitter * 2 * Math.PI / params.numWaypoints

      // Vary radius
      const radiusFactor = 1 + (seededRandom() - 0.5) * 2 * params.radiusVariation
      let pointRadiusKm = idealRadiusKm * radiusFactor

      // Bias toward nearby interesting points
      let targetLat = startLat + pointRadiusKm * Math.sin(jitteredAngle) / 111
      let targetLng = startLng + pointRadiusKm * Math.cos(jitteredAngle) / (111 * Math.cos(startLat * Math.PI / 180))

      if (nearbyPoints.length > 0 && seededRandom() > 0.6) {
        // Pull this waypoint toward an interesting point
        const attractIdx = Math.floor(seededRandom() * Math.min(3, nearbyPoints.length))
        const attractor = nearbyPoints[attractIdx]
        const pullFactor = 0.3 + seededRandom() * 0.3
        targetLat = targetLat * (1 - pullFactor) + attractor.lat * pullFactor
        targetLng = targetLng * (1 - pullFactor) + attractor.lng * pullFactor
      }

      // For twisty style, add wobble points
      if (rideStyle === 'twisty' && seededRandom() > 0.5) {
        const wobbleAngle = jitteredAngle - params.direction * 0.15
        const wobbleRadius = pointRadiusKm * (0.7 + seededRandom() * 0.5)
        const wobbleLat = startLat + wobbleRadius * Math.sin(wobbleAngle) / 111
        const wobbleLng = startLng + wobbleRadius * Math.cos(wobbleAngle) / (111 * Math.cos(startLat * Math.PI / 180))
        waypoints.push({ lat: wobbleLat, lng: wobbleLng })
      }

      waypoints.push({ lat: targetLat, lng: targetLng })
    }

    // Close the loop
    waypoints.push({ lat: startLat, lng: startLng, name: 'Konec' })

    // Calculate total distance
    let totalDistance = 0
    for (let i = 1; i < waypoints.length; i++) {
      const dLat = (waypoints[i].lat - waypoints[i - 1].lat) * 111
      const dLng = (waypoints[i].lng - waypoints[i - 1].lng) * 111 * Math.cos(waypoints[i].lat * Math.PI / 180)
      totalDistance += Math.sqrt(dLat * dLat + dLng * dLng)
    }

    // Generate style-specific description
    const styleDescriptions: Record<string, string> = {
      scenic: `Scenična tura ${Math.round(totalDistance)} km — uživajte v pokrajini in razgledih`,
      twisty: `Vijugasta tura ${Math.round(totalDistance)} km — ostrite zavoji in adrenalinske krivine`,
      touring: `Turneja ${Math.round(totalDistance)} km — daljša tura z lepimi odseki`,
      offroad: `Terenska tura ${Math.round(totalDistance)} km — makadam in gozdne ceste`,
    }

    const styleEmoji: Record<string, string> = {
      scenic: '🏔️', twisty: '🔄', touring: '🛣️', offroad: '🪨',
    }

    const styleNames: Record<string, string> = {
      scenic: 'Scenična', twisty: 'Vijugasta', touring: 'Turneja', offroad: 'Terenska',
    }

    // Estimate duration
    const avgSpeed = rideStyle === 'offroad' ? 30 : rideStyle === 'twisty' ? 45 : rideStyle === 'touring' ? 55 : 50
    const estimatedMinutes = Math.round((totalDistance / avgSpeed) * 60)

    return NextResponse.json({
      success: true,
      data: {
        waypoints,
        totalDistance: Math.round(totalDistance * 10) / 10,
        estimatedMinutes,
        style: rideStyle,
        styleName: styleNames[rideStyle] || 'Scenična',
        styleEmoji: styleEmoji[rideStyle] || '🏔️',
        description: styleDescriptions[rideStyle] || styleDescriptions.scenic,
        title: `${styleEmoji[rideStyle] || '🏔️'} AI ${styleNames[rideStyle] || 'Scenična'} tura — ${Math.round(totalDistance)} km`,
        nearbyAttractions: nearbyPoints.slice(0, 3).map(p => p.name),
      },
    })
  } catch (error) {
    console.error('AI route planner error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate route' },
      { status: 500 }
    )
  }
}
