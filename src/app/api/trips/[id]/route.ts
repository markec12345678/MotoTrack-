import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/trips/[id] - Get single trip with all days
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const trip = await db.trip.findUnique({
      where: { id },
      include: {
        tripDays: { orderBy: { dayNumber: 'asc' } },
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    if (!trip) {
      return NextResponse.json({ error: 'Potovanje ni najdeno' }, { status: 404 })
    }

    return NextResponse.json({ data: trip })
  } catch (error) {
    console.error('Error fetching trip:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju potovanja' }, { status: 500 })
  }
}

// PUT /api/trips/[id] - Update trip
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, description, startDate, endDate, isPublic, days } = body

    // Check trip exists
    const existing = await db.trip.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Potovanje ni najdeno' }, { status: 404 })
    }

    // Calculate total distance from days
    const totalDistance = days
      ? days.reduce((sum: number, d: { distance?: number }) => sum + (d.distance || 0), 0)
      : existing.totalDistance

    const numDays = days ? days.length : existing.days

    // Delete existing trip days and recreate
    if (days) {
      await db.tripDay.deleteMany({ where: { tripId: id } })
    }

    const trip = await db.trip.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        description: description !== undefined ? description : existing.description,
        startDate: startDate ? new Date(startDate) : existing.startDate,
        endDate: endDate ? new Date(endDate) : existing.endDate,
        days: numDays,
        totalDistance,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
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

    return NextResponse.json({ data: trip })
  } catch (error) {
    console.error('Error updating trip:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju potovanja' }, { status: 500 })
  }
}

// DELETE /api/trips/[id] - Delete trip (cascade days)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.trip.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Potovanje ni najdeno' }, { status: 404 })
    }

    await db.trip.delete({ where: { id } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Error deleting trip:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju potovanja' }, { status: 500 })
  }
}
