import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const challenge = await db.challenge.findUnique({
      where: { id },
      include: { participants: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { progress: 'desc' } } }
    })
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    return NextResponse.json({ data: challenge })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const existing = await db.challengeParticipant.findUnique({ where: { challengeId_userId: { challengeId: id, userId } } })
    if (existing) return NextResponse.json({ error: 'Already joined' }, { status: 400 })

    const participant = await db.challengeParticipant.create({ data: { challengeId: id, userId } })
    return NextResponse.json({ data: participant })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
