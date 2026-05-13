import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/compare - Compare rides on the same route/area
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Get the current ride for reference if rideId provided
    let currentRide = null
    if (rideId) {
      currentRide = await db.ride.findUnique({
        where: { id: rideId },
        select: {
          id: true,
          startLat: true,
          startLng: true,
          endLat: true,
          endLng: true,
        },
      })
    }

    // Build where clause for finding comparable rides
    const where: Record<string, unknown> = {
      userId,
      isPublic: true,
    }

    // Exclude the current ride from comparison
    if (rideId) {
      where.id = { not: rideId }
    }

    // If routeId provided, get route's waypoints to find geographically overlapping rides
    let routeCenter: { lat: number; lng: number } | null = null
    if (routeId) {
      const route = await db.route.findUnique({
        where: { id: routeId },
        select: { waypoints: true },
      })
      if (route?.waypoints) {
        try {
          const waypoints = JSON.parse(route.waypoints) as Array<{ lat: number; lng: number }>
          if (waypoints.length > 0) {
            const avgLat = waypoints.reduce((s: number, w: { lat: number }) => s + w.lat, 0) / waypoints.length
            const avgLng = waypoints.reduce((s: number, w: { lng: number }) => s + w.lng, 0) / waypoints.length
            routeCenter = { lat: avgLat, lng: avgLng }
          }
        } catch {
          // ignore parse errors
        }
      }
    } else if (currentRide?.startLat && currentRide?.startLng) {
      // Use current ride's start as center for geographic comparison
      routeCenter = { lat: currentRide.startLat, lng: currentRide.startLng }
    }

    // Fetch all user's rides (we'll filter by proximity in code for accuracy)
    const allRides = await db.ride.findMany({
      where,
      select: {
        id: true,
        title: true,
        distance: true,
        duration: true,
        avgSpeed: true,
        maxSpeed: true,
        elevation: true,
        startLat: true,
        startLng: true,
        endLat: true,
        endLng: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Filter rides by geographic proximity if we have a center point
    let comparableRides = allRides
    if (routeCenter) {
      const RADIUS_KM = 50 // Consider rides within 50km of the route center
      comparableRides = allRides.filter(ride => {
        const rideLat = ride.startLat ?? ride.endLat
        const rideLng = ride.startLng ?? ride.endLng
        if (rideLat == null || rideLng == null) return true // include rides without location data

        const dist = haversine(routeCenter!.lat, routeCenter!.lng, rideLat, rideLng)
        return dist <= RADIUS_KM
      })

      // If too few rides found in the area, fall back to all user rides
      if (comparableRides.length < 2) {
        comparableRides = allRides
      }
    }

    // Limit to 10 rides for comparison
    comparableRides = comparableRides.slice(0, 10)

    // Map to response format
    const rides = comparableRides.map(r => ({
      id: r.id,
      title: r.title,
      date: r.createdAt.toISOString(),
      distance: r.distance,
      duration: r.duration,
      avgSpeed: r.avgSpeed,
      maxSpeed: r.maxSpeed,
      elevation: r.elevation,
    }))

    // Calculate best values
    const best = {
      distance: rides.length > 0 ? Math.max(...rides.map(r => r.distance)) : 0,
      duration: rides.length > 0 ? Math.min(...rides.map(r => r.duration)) : 0, // lowest is best
      avgSpeed: rides.length > 0 ? Math.max(...rides.map(r => r.avgSpeed)) : 0,
      maxSpeed: rides.length > 0 ? Math.max(...rides.map(r => r.maxSpeed)) : 0,
      elevation: rides.length > 0 ? Math.max(...rides.map(r => r.elevation)) : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        rides,
        best,
      },
    })
  } catch (error) {
    console.error('Compare rides error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to compare rides' },
      { status: 500 }
    )
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
