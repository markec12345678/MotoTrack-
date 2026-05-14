import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/stats - Aggregate platform statistics
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [totalRides, totalRoutes, totalUsers, rideAggregates] = await Promise.all([
      db.ride.count({ where: { isPublic: true } }),
      db.route.count({ where: { isPublic: true } }),
      db.user.count(),
      db.ride.aggregate({
        _sum: {
          distance: true,
        },
        _avg: {
          distance: true,
        },
      }),
    ])

    const totalDistance = rideAggregates._sum.distance || 0
    const avgRideDistance = rideAggregates._avg.distance || 0

    // Get some additional interesting stats
    const recentRides = await db.ride.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        distance: true,
        createdAt: true,
        user: {
          select: { name: true, avatar: true },
        },
      },
    })

    const topRoutes = await db.route.findMany({
      where: { isPublic: true },
      orderBy: { likes: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        distance: true,
        likes: true,
        category: true,
        difficulty: true,
      },
    })

    const categoryBreakdown = await db.route.groupBy({
      by: ['category'],
      where: { isPublic: true },
      _count: { id: true },
    })

    const difficultyBreakdown = await db.route.groupBy({
      by: ['difficulty'],
      where: { isPublic: true },
      _count: { id: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalRides,
        totalRoutes,
        totalUsers,
        totalDistance: Math.round(totalDistance * 10) / 10,
        avgRideDistance: Math.round(avgRideDistance * 10) / 10,
        recentRides,
        topRoutes,
        categoryBreakdown: categoryBreakdown.map((c) => ({
          category: c.category,
          count: c._count.id,
        })),
        difficultyBreakdown: difficultyBreakdown.map((d) => ({
          difficulty: d.difficulty,
          count: d._count.id,
        })),
      },
    })
  } catch (error) {
    console.error('Fetch stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
