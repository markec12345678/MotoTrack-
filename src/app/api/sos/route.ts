import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (status) where.status = status

    const alerts = await db.sosAlert.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, iceName1: true, icePhone1: true, iceName2: true, icePhone2: true, bloodType: true, allergies: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('SOS GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju alertov' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, lat, lng, type, message } = body

    if (!userId || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Manjkajoči podatki (userId, lat, lng)' }, { status: 400 })
    }

    const alert = await db.sosAlert.create({
      data: {
        userId,
        lat: parseFloat(String(lat)),
        lng: parseFloat(String(lng)),
        type: type || 'manual',
        status: 'active',
        message: message || null,
      },
    })

    // Get user's emergency info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        iceName1: true,
        icePhone1: true,
        iceName2: true,
        icePhone2: true,
        bloodType: true,
        allergies: true,
      },
    })

    // Find nearest hospitals/medical from POIs (mechanic as proxy for closest help)
    const allPois = await db.poi.findMany({
      where: { type: 'mechanic' },
    })

    let nearestHelp: { name: string; lat: number; lng: number; distance: number } | null = null
    if (allPois.length > 0) {
      const R = 6371
      let minDist = Infinity
      for (const poi of allPois) {
        const dLat = ((poi.lat - alert.lat) * Math.PI) / 180
        const dLon = ((poi.lng - alert.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((alert.lat * Math.PI) / 180) * Math.cos((poi.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        if (dist < minDist) {
          minDist = dist
          nearestHelp = { name: poi.name, lat: poi.lat, lng: poi.lng, distance: Math.round(dist * 10) / 10 }
        }
      }
    }

    return NextResponse.json({
      data: {
        alert: {
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
        emergencyInfo: {
          user: user ? { name: user.name, bloodType: user.bloodType, allergies: user.allergies } : null,
          iceContacts: user
            ? [
                user.iceName1 ? { name: user.iceName1, phone: user.icePhone1 } : null,
                user.iceName2 ? { name: user.iceName2, phone: user.icePhone2 } : null,
              ].filter(Boolean)
            : [],
          nearestHelp,
        },
      },
    })
  } catch (error) {
    console.error('SOS POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju alerta' }, { status: 500 })
  }
}
