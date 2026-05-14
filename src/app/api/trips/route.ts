import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/trips - List trips
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const isPublic = searchParams.get('public')

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (isPublic === 'true') where.isPublic = true

    const trips = await db.trip.findMany({
      where,
      include: {
        tripDays: { orderBy: { dayNumber: 'asc' } },
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: trips })
  } catch (error) {
    console.error('Error fetching trips:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju potovanj' }, { status: 500 })
  }
}

// POST /api/trips - Create trip with days
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, startDate, endDate, isPublic, userId, days } = body

    if (!title || !startDate || !endDate || !userId) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    // Calculate total distance
    const totalDistance = days
      ? days.reduce((sum: number, d: { distance?: number }) => sum + (d.distance || 0), 0)
      : 0

    const numDays = days ? days.length : 1

    const trip = await db.trip.create({
      data: {
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days: numDays,
        totalDistance,
        isPublic: isPublic !== false,
        userId,
        tripDays: days
          ? {
              create: days.map((day: { dayNumber: number; title: string; startLat: number; startLng: number; endLat: number; endLng: number; waypoints: string; distance: number; duration: number; notes?: string; accommodation?: string; fuelStop?: boolean }) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                startLat: day.startLat,
                startLng: day.startLng,
                endLat: day.endLat,
                endLng: day.endLng,
                waypoints: day.waypoints || '[]',
                distance: day.distance || 0,
                duration: day.duration || 0,
                notes: day.notes || null,
                accommodation: day.accommodation || null,
                fuelStop: day.fuelStop || false,
              })),
            }
          : undefined,
      },
      include: {
        tripDays: { orderBy: { dayNumber: 'asc' } },
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    return NextResponse.json({ data: trip }, { status: 201 })
  } catch (error) {
    console.error('Error creating trip:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju potovanja' }, { status: 500 })
  }
}
