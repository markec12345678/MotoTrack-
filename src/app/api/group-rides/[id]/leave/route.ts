import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { userId } = body

    if (!userId) return NextResponse.json({ error: 'userId je obvezen' }, { status: 400 })

    await db.groupRideParticipant.deleteMany({
      where: { groupRideId: id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GroupRide Leave error:', error)
    return NextResponse.json({ error: 'Napaka pri zapuščanju' }, { status: 500 })
  }
}
