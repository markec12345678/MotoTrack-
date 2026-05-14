import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/events - Fetch events with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const category = searchParams.get('category')
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isPublic: true }

    if (country) {
      where.country = country.toUpperCase()
    }

    if (category) {
      where.category = category
    }

    if (upcoming) {
      where.date = { gte: new Date() }
    }

    const events = await db.motoEvent.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: events,
      count: events.length,
    })
  } catch (error) {
    console.error('Fetch events error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      date,
      endDate,
      lat,
      lng,
      location,
      country,
      category,
      website,
      organizerName,
      contactEmail,
      createdBy,
    } = body

    if (!title || !date || lat === undefined || lng === undefined || !location || !country) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, date, lat, lng, location, country' },
        { status: 400 }
      )
    }

    const event = await db.motoEvent.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        lat: parseFloat(String(lat)),
        lng: parseFloat(String(lng)),
        location,
        country: country.toUpperCase(),
        category: category || 'meet',
        website: website || null,
        organizerName: organizerName || null,
        contactEmail: contactEmail || null,
        createdBy: createdBy || null,
      },
    })

    return NextResponse.json(
      { success: true, data: event },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
