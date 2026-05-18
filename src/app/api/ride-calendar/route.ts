import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET: Get rides grouped by month/week for calendar view
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'default'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

    let whereClause: any = { userId }

    if (month !== undefined) {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 1)
      whereClause.createdAt = { gte: startDate, lt: endDate }
    } else {
      const startDate = new Date(year, 0, 1)
      const endDate = new Date(year + 1, 0, 1)
      whereClause.createdAt = { gte: startDate, lt: endDate }
    }

    const rides = await db.ride.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        distance: true,
        duration: true,
        maxSpeed: true,
        elevation: true,
        createdAt: true,
        trackData: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Group by date
    const calendarDays = new Map<string, Array<{
      id: string
      title: string
      distance: number
      duration: number
      maxSpeed: number
      elevation: number
      hour: number
    }>>()

    for (const ride of rides) {
      const dateKey = ride.createdAt.toISOString().split('T')[0]
      if (!calendarDays.has(dateKey)) {
        calendarDays.set(dateKey, [])
      }
      calendarDays.get(dateKey)!.push({
        id: ride.id,
        title: ride.title,
        distance: ride.distance,
        duration: ride.duration,
        maxSpeed: ride.maxSpeed,
        elevation: ride.elevation,
        hour: ride.createdAt.getHours(),
      })
    }

    // Monthly stats
    const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0)
    const totalDuration = rides.reduce((sum, r) => sum + r.duration, 0)
    const totalElevation = rides.reduce((sum, r) => sum + r.elevation, 0)
    const longestRide = rides.reduce((max, r) => r.distance > max ? r.distance : max, 0)
    const fastestRide = rides.reduce((max, r) => r.maxSpeed > max ? r.maxSpeed : max, 0)

    return NextResponse.json({
      rides: Object.fromEntries(calendarDays),
      stats: {
        totalRides: rides.length,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalDuration,
        totalElevation,
        longestRide,
        fastestRide,
        avgDistance: rides.length > 0 ? Math.round(totalDistance / rides.length * 10) / 10 : 0,
        avgDuration: rides.length > 0 ? Math.round(totalDuration / rides.length) : 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Napaka pri pridobivanju koledarja' }, { status: 500 })
  }
}
