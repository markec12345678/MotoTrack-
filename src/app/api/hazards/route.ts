import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (type) where.type = type

    const hazards = await db.hazard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ data: hazards })
  } catch (error) {
    console.error('Hazards fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju opozoril' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, description, lat, lng, userId } = body

    if (!type || !name || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const hazard = await db.hazard.create({
      data: {
        type,
        name,
        description: description || null,
        lat,
        lng,
        userId: userId || null,
      },
    })

    return NextResponse.json({ data: hazard })
  } catch (error) {
    console.error('Hazard create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju opozorila' }, { status: 500 })
  }
}
