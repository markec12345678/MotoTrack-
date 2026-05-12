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
