import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const session = await db.liveTrackingSession.findUnique({ where: { shareToken: token }, include: { user: { select: { name: true } } } })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Track viewer
    await db.liveTrackingViewer.create({ data: { sessionId: session.id } })

    return NextResponse.json({
      data: {
        userName: session.user.name,
        lat: session.lat,
        lng: session.lng,
        speed: session.speed,
        heading: session.heading,
        lastUpdate: session.lastPingAt,
        isActive: session.isActive,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
