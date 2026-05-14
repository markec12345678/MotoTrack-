import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const category = searchParams.get('category')
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isPublic: true }
    if (country) where.country = country
    if (category) where.category = category
    if (upcoming) where.date = { gte: new Date().toISOString() }

    const events = await db.motoEvent.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    })

    return NextResponse.json({ data: events })
  } catch (error) {
    console.error('Events fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dogodkov' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, date, endDate, lat, lng, location, country, category, website, organizerName, contactEmail, createdBy } = body

    if (!title || !date || !lat || !lng || !location || !country) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const event = await db.motoEvent.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        location,
        country,
        category: category || 'meet',
        website: website || null,
        organizerName: organizerName || null,
        contactEmail: contactEmail || null,
        createdBy: createdBy || null,
      },
    })

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error) {
    console.error('Event create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju dogodka' }, { status: 500 })
  }
}
