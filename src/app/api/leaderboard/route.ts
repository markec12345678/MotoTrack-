import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/leaderboard - Return all users ranked by total distance (descending)
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        avatar: true,
        bike: true,
        rides: {
          select: {
            distance: true,
            elevation: true,
          },
        },
        _count: {
          select: {
            rides: true,
            routes: true,
          },
        },
      },
    })

    const leaderboard = users
      .map((user) => {
        const totalDistance = user.rides.reduce((sum, r) => sum + r.distance, 0)
        const totalElevation = user.rides.reduce((sum, r) => sum + r.elevation, 0)

        return {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          bike: user.bike,
          totalRides: user._count.rides,
          totalRoutes: user._count.routes,
          totalDistance: Math.round(totalDistance * 10) / 10,
          totalElevation: Math.round(totalElevation),
        }
      })
      .sort((a, b) => b.totalDistance - a.totalDistance)

    return NextResponse.json({
      success: true,
      data: leaderboard,
    })
  } catch (error) {
    console.error('Fetch leaderboard error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
