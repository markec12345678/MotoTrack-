import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CRASH_GFORCE_THRESHOLD = 3.0

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, lat, lng, gForce, speedBefore } = await req.json()
    if (!userId || !lat || !lng || gForce === undefined) {
      return NextResponse.json({ error: 'userId, lat, lng, gForce required' }, { status: 400 })
    }

    let alertSent = false
    let contactsNotified: string[] = []

    // If gForce exceeds threshold, create SOS alert and notify emergency contacts
    if (gForce >= CRASH_GFORCE_THRESHOLD) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (user) {
        // Create SOS alert
        await db.sosAlert.create({
          data: { userId, lat, lng, type: 'crash_detected', status: 'active', message: `Zaznan trk! G-sila: ${gForce}g, Hitrost: ${speedBefore || 0}km/h` }
        })

        // Notify emergency contacts
        if (user.iceName1 || user.iceName2) {
          contactsNotified = [user.iceName1, user.iceName2].filter(Boolean) as string[]
          alertSent = true

          // Create notification
          await db.notification.create({
            data: { userId, type: 'hazard_nearby', title: '🚨 Zaznan trk!', message: `Samodejno zaznan trk na lokaciji. G-sila: ${gForce}g`, read: false }
          })
        }
      }
    }

    const crashEvent = await db.crashEvent.create({
      data: { userId, lat, lng, gForce, speedBefore: speedBefore || 0, alertSent, alertSentTo: contactsNotified.length > 0 ? JSON.stringify(contactsNotified) : null }
    })

    return NextResponse.json({
      data: {
        crashEventId: crashEvent.id,
        alertSent,
        emergencyContactsNotified: contactsNotified,
        gForceThreshold: CRASH_GFORCE_THRESHOLD,
      }
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const events = await db.crashEvent.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ data: events })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
