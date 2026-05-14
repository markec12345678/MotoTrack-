import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const lat = req.nextUrl.searchParams.get('lat')
    const lng = req.nextUrl.searchParams.get('lng')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        parkedLat: true,
        parkedLng: true,
        parkedAt: true,
        parkedNote: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const data: {
      parkedLat: number | null
      parkedLng: number | null
      parkedAt: string | null
      parkedNote: string | null
      distance?: number
    } = {
      parkedLat: user.parkedLat,
      parkedLng: user.parkedLng,
      parkedAt: user.parkedAt?.toISOString() ?? null,
      parkedNote: user.parkedNote,
    }

    // Calculate distance from current position if provided and parked location exists
    if (lat && lng && user.parkedLat !== null && user.parkedLng !== null) {
      const currentLat = parseFloat(lat)
      const currentLng = parseFloat(lng)
      if (!isNaN(currentLat) && !isNaN(currentLng)) {
        data.distance = Math.round(haversineKm(currentLat, currentLng, user.parkedLat, user.parkedLng) * 1000) / 1000
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Parking GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, lat, lng, note } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await db.user.update({
      where: { id: userId },
      data: {
        parkedLat: lat,
        parkedLng: lng,
        parkedAt: new Date(),
        parkedNote: note || null,
      },
    })

    const updated = await db.user.findUnique({
      where: { id: userId },
      select: {
        parkedLat: true,
        parkedLng: true,
        parkedAt: true,
        parkedNote: true,
      },
    })

    return NextResponse.json({
      data: {
        parkedLat: updated!.parkedLat,
        parkedLng: updated!.parkedLng,
        parkedAt: updated!.parkedAt?.toISOString() ?? null,
        parkedNote: updated!.parkedNote,
      },
    })
  } catch (error) {
    console.error('Parking POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await db.user.update({
      where: { id: userId },
      data: {
        parkedLat: null,
        parkedLng: null,
        parkedAt: null,
        parkedNote: null,
      },
    })

    return NextResponse.json({ data: { cleared: true } })
  } catch (error) {
    console.error('Parking DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
