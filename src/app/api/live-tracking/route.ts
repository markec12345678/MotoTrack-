import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, lat, lng, speed, heading } = await req.json()
    if (!userId || !lat || !lng) return NextResponse.json({ error: 'userId, lat, lng required' }, { status: 400 })

    const shareToken = crypto.randomBytes(8).toString('hex')
    const session = await db.liveTrackingSession.create({
      data: { userId, lat, lng, speed: speed || 0, heading: heading || 0, shareToken, isActive: true, lastPingAt: new Date() }
    })

    return NextResponse.json({
      data: {
        id: session.id,
        shareToken: session.shareToken,
        shareUrl: `/live/${session.shareToken}`,
        isActive: session.isActive,
        startedAt: session.createdAt,
        viewerCount: 0,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { sessionId, lat, lng, speed, heading } = await req.json()
    if (!sessionId || !lat || !lng) return NextResponse.json({ error: 'sessionId, lat, lng required' }, { status: 400 })

    const session = await db.liveTrackingSession.update({
      where: { id: sessionId },
      data: { lat, lng, speed: speed || 0, heading: heading || 0, lastPingAt: new Date() }
    })

    return NextResponse.json({ data: { updated: true, lastPingAt: session.lastPingAt } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    await db.liveTrackingSession.update({ where: { id: sessionId }, data: { isActive: false } })
    return NextResponse.json({ data: { ended: true } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const sessions = await db.liveTrackingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { _count: { select: { viewers: true } } }
    })

    return NextResponse.json({ data: sessions.map(s => ({ ...s, viewerCount: s._count.viewers })) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
