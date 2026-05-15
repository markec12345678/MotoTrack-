import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/privacy-zones?userId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const zones = await db.privacyZone.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: zones })
  } catch (error) {
    console.error('PrivacyZones GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch privacy zones' }, { status: 500 })
  }
}

// POST /api/privacy-zones
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, name, lat, lng, radiusMeters } = body
    if (!userId || !name || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'userId, name, lat, lng required' }, { status: 400 })
    }

    const zone = await db.privacyZone.create({
      data: {
        userId,
        name,
        lat,
        lng,
        radiusMeters: radiusMeters || 200,
      },
    })

    return NextResponse.json({ data: zone }, { status: 201 })
  } catch (error) {
    console.error('PrivacyZones POST error:', error)
    return NextResponse.json({ error: 'Failed to create privacy zone' }, { status: 500 })
  }
}

// DELETE /api/privacy-zones
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    if (!id || !userId) return NextResponse.json({ error: 'id and userId required' }, { status: 400 })

    await db.privacyZone.delete({
      where: { id, userId },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('PrivacyZones DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete privacy zone' }, { status: 500 })
  }
}
