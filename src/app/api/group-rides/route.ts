import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'upcoming'
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const groupRides = await db.groupRide.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    })

    // Fetch participants and creator separately to avoid complex includes
    const ridesWithCounts = await Promise.all(
      groupRides.map(async (gr) => {
        const [creator, participants] = await Promise.all([
          db.user.findUnique({ where: { id: gr.creatorId }, select: { id: true, name: true, avatar: true, bike: true } }),
          db.groupRideParticipant.findMany({
            where: { groupRideId: gr.id },
            include: { user: { select: { id: true, name: true, avatar: true, bike: true } } },
          }),
        ])
        return {
          id: gr.id,
          title: gr.title,
          description: gr.description,
          date: gr.date.toISOString(),
          meetingLat: gr.meetingLat,
          meetingLng: gr.meetingLng,
          meetingPlace: gr.meetingPlace,
          destinationLat: gr.destinationLat,
          destinationLng: gr.destinationLng,
          destinationPlace: gr.destinationPlace,
          maxRiders: gr.maxRiders,
          category: gr.category,
          status: gr.status,
          creator,
          participantCount: participants.length,
          participants: participants.map(p => ({
            id: p.id,
            userId: p.userId,
            status: p.status,
            joinedAt: p.joinedAt.toISOString(),
            user: p.user,
          })),
        }
      })
    )

    return NextResponse.json({ success: true, data: ridesWithCounts })
  } catch (error) {
    console.error('GroupRides GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju skupinskih voženj' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { creatorId, title, description, date, meetingLat, meetingLng, meetingPlace, destinationLat, destinationLng, destinationPlace, maxRiders, category } = body

    if (!creatorId || !title || !date || meetingLat == null || meetingLng == null || !meetingPlace) {
      return NextResponse.json({ error: 'Manjkajo obvezni podatki' }, { status: 400 })
    }

    const groupRide = await db.groupRide.create({
      data: {
        creatorId,
        title,
        description: description || null,
        date: new Date(date),
        meetingLat: parseFloat(String(meetingLat)),
        meetingLng: parseFloat(String(meetingLng)),
        meetingPlace,
        destinationLat: destinationLat ? parseFloat(String(destinationLat)) : null,
        destinationLng: destinationLng ? parseFloat(String(destinationLng)) : null,
        destinationPlace: destinationPlace || null,
        maxRiders: maxRiders ? parseInt(String(maxRiders)) : 10,
        category: category || 'scenic',
      },
    })

    // Creator auto-joins
    await db.groupRideParticipant.create({
      data: {
        groupRideId: groupRide.id,
        userId: creatorId,
        status: 'joined',
      },
    })

    return NextResponse.json({ success: true, data: groupRide })
  } catch (error) {
    console.error('GroupRides POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju skupinske vožnje' }, { status: 500 })
  }
}
