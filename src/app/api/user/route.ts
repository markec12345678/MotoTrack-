import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await db.user.findFirst()
    if (!user) {
      return NextResponse.json({ error: 'No user found' }, { status: 404 })
    }

    const rideCount = await db.ride.count({ where: { userId: user.id } })
    const routeCount = await db.route.count({ where: { userId: user.id } })

    const rides = await db.ride.findMany({
      where: { userId: user.id },
      select: { distance: true, elevation: true, avgSpeed: true },
    })

    const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0)
    const totalElevation = rides.reduce((sum, r) => sum + r.elevation, 0)
    const avgSpeed = rides.length > 0 ? rides.reduce((sum, r) => sum + r.avgSpeed, 0) / rides.length : 0

    return NextResponse.json({
      ...user,
      stats: {
        totalRides: rideCount,
        totalRoutes: routeCount,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalElevation: Math.round(totalElevation),
        avgSpeed: Math.round(avgSpeed * 10) / 10,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}
