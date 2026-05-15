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
      }),
      db.route.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    // Seed check: if no users, suggest seeding
    const needsSeed = users.length === 0

    // Get first user as default (for demo purposes)
    const defaultUser = users[0] || null

    // Simple leaderboard
    const leaderboard = users.slice(0, 10).map(u => ({
      id: u.id,
      name: u.name,
      totalDistance: 0,
      totalRides: 0,
    }))

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
