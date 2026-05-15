import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status, notes } = await req.json()
    if (!status || !['confirmed', 'false_alarm'].includes(status)) {
      return NextResponse.json({ error: 'Status must be confirmed or false_alarm' }, { status: 400 })
    }

    const event = await db.crashEvent.update({
      where: { id },
      data: { status, notes: notes || undefined, resolvedAt: new Date() }
    })

    // If false alarm, resolve the associated SOS alert
    if (status === 'false_alarm') {
      await db.sosAlert.updateMany({
        where: { userId: event.userId, type: 'crash_detected', status: 'active' },
        data: { status: 'false_alarm', resolvedAt: new Date() }
      })
    }

    return NextResponse.json({ data: event })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
