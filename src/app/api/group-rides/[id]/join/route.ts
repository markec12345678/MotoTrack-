import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { userId, status } = body

    if (!userId) return NextResponse.json({ error: 'userId je obvezen' }, { status: 400 })

    // Check if already a participant
    const existing = await db.groupRideParticipant.findUnique({
      where: { groupRideId_userId: { groupRideId: id, userId } },
    })
    if (existing) {
      // Update status
      const updated = await db.groupRideParticipant.update({
        where: { id: existing.id },
        data: { status: status || 'joined' },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    // Check max riders
    const ride = await db.groupRide.findUnique({
      where: { id },
      include: { _count: { select: { participants: { where: { status: 'joined' } } } } },
    })
    if (ride && ride._count.participants >= ride.maxRiders) {
      return NextResponse.json({ error: 'Skupinska vožnja je polna' }, { status: 400 })
    }

    const participant = await db.groupRideParticipant.create({
      data: { groupRideId: id, userId, status: status || 'joined' },
    })

    return NextResponse.json({ success: true, data: participant })
  } catch (error) {
    console.error('GroupRide Join error:', error)
    return NextResponse.json({ error: 'Napaka pri pridružitvi' }, { status: 500 })
  }
}
