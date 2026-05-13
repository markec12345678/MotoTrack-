import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (type && type !== 'all') {
      where.type = type
    }

    const pois = await db.poi.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: pois })
  } catch (error) {
    console.error('POIs fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju POI-jev' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, lat, lng, description, rating, userId } = body

    if (!name || !type || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Manjkajoči podatki (ime, tip, lat, lng)' }, { status: 400 })
    }

    const poi = await db.poi.create({
      data: {
        name,
        type,
        lat,
        lng,
        description: description || null,
        rating: rating || 0,
        userId: userId || null,
      },
    })

    return NextResponse.json({ data: poi })
  } catch (error) {
    console.error('POI create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju POI' }, { status: 500 })
  }
}
