import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/users/[id] - Fetch user profile with rides and route count
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bike: true,
        bio: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user's rides with pagination
    const [rides, rideCount, routeCount, rideStats] = await Promise.all([
      db.ride.findMany({
        where: { userId: id, isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
          isPublic: true,
          isLive: true,
          createdAt: true,
        },
      }),
      db.ride.count({ where: { userId: id } }),
      db.route.count({ where: { userId: id } }),
      db.ride.aggregate({
        where: { userId: id },
        _sum: { distance: true, elevation: true },
        _avg: { avgSpeed: true },
        _max: { maxSpeed: true, distance: true },
      }),
    ])

    const totalDistance = rideStats._sum.distance || 0
    const totalElevation = rideStats._sum.elevation || 0
    const avgSpeed = rideStats._avg.avgSpeed || 0
    const maxSpeed = rideStats._max.maxSpeed || 0
    const longestRide = rideStats._max.distance || 0

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        stats: {
          totalRides: rideCount,
          totalRoutes: routeCount,
          totalDistance: Math.round(totalDistance * 10) / 10,
          totalElevation: Math.round(totalElevation),
          avgSpeed: Math.round(avgSpeed * 10) / 10,
          maxSpeed: Math.round(maxSpeed * 10) / 10,
          longestRide: Math.round(longestRide * 10) / 10,
        },
        rides,
      },
    })
  } catch (error) {
    console.error('Fetch user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
