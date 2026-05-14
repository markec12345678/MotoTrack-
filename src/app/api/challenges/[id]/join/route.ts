import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const challenge = await db.challenge.findUnique({
      where: { id: challengeId },
    })

    if (!challenge) {
      return NextResponse.json({ error: 'Izziv ni najden' }, { status: 404 })
    }

    // Check if already joined
    const existing = await db.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ste že pridruženi temu izzivu' }, { status: 400 })
    }

    // Check if challenge is still active
    if (new Date() > new Date(challenge.endDate)) {
      return NextResponse.json({ error: 'Izziv je že končan' }, { status: 400 })
    }

    const participant = await db.challengeParticipant.create({
      data: {
        challengeId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    return NextResponse.json({ data: participant })
  } catch (error) {
    console.error('Challenge join error:', error)
    return NextResponse.json({ error: 'Napaka pri pridružitvi izzivu' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const participant = await db.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Niste pridruženi temu izzivu' }, { status: 404 })
    }

    await db.challengeParticipant.delete({
      where: { id: participant.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Challenge leave error:', error)
    return NextResponse.json({ error: 'Napaka pri zapustitvi izziva' }, { status: 500 })
  }
}
