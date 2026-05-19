import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch all initial data in one request to reduce concurrent API calls
    // This prevents memory spikes from multiple simultaneous SSR/API requests

    const [users, rides, routes] = await Promise.all([
      db.user.findMany({
        select: { id: true, name: true, email: true, avatar: true, bike: true, bio: true }
      }),
      db.ride.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      db.route.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
    ])

    // Seed check: if no users, suggest seeding
    const needsSeed = users.length === 0

    // Get first user as default (for demo purposes) WITH stats
    const firstDbUser = users[0] || null
    let defaultUser = null
    if (firstDbUser) {
      const userRides = await db.ride.findMany({
        where: { userId: firstDbUser.id },
        select: { distance: true, elevation: true, avgSpeed: true },
      })
      const userRoutes = await db.route.count({
        where: { userId: firstDbUser.id },
      })
      defaultUser = {
        ...firstDbUser,
        stats: {
          totalRides: userRides.length,
          totalRoutes: userRoutes,
          totalDistance: Math.round(userRides.reduce((s, r) => s + r.distance, 0)),
          totalElevation: Math.round(userRides.reduce((s, r) => s + r.elevation, 0)),
          avgSpeed: userRides.length > 0 ? Math.round(userRides.reduce((s, r) => s + r.avgSpeed, 0) / userRides.length) : 0,
        },
      }
    }

    // Compute leaderboard with actual ride stats
    const leaderboard = await Promise.all(
      users.slice(0, 10).map(async (u) => {
        const uRides = await db.ride.findMany({
          where: { userId: u.id },
          select: { distance: true, elevation: true },
        })
        const uRoutes = await db.route.count({
          where: { userId: u.id },
        })
        return {
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          bike: u.bike,
          totalRides: uRides.length,
          totalRoutes: uRoutes,
          totalDistance: Math.round(uRides.reduce((s, r) => s + r.distance, 0)),
          totalElevation: Math.round(uRides.reduce((s, r) => s + r.elevation, 0)),
        }
      })
    )

    return NextResponse.json({
      data: {
        users,
        rides,
        routes,
        defaultUser,
        needsSeed,
        leaderboard,
      }
    })
  } catch (error) {
    console.error('[/api/init] Error:', error)
    return NextResponse.json(
      { data: { users: [], rides: [], routes: [], defaultUser: null, needsSeed: true, leaderboard: [] } },
      { status: 200 }
    )
  }
}
