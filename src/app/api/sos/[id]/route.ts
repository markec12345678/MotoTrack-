import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status } = body

    if (!status || !['resolved', 'false_alarm'].includes(status)) {
      return NextResponse.json({ error: 'Neveljaven status (resolved ali false_alarm)' }, { status: 400 })
    }

    const alert = await db.sosAlert.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({
      data: {
        id: alert.id,
        userId: alert.userId,
        lat: alert.lat,
        lng: alert.lng,
        type: alert.type,
        status: alert.status,
        message: alert.message,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        createdAt: alert.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('SOS PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi alerta' }, { status: 500 })
  }
}
