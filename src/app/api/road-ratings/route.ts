import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/road-ratings — List road ratings with optional bounding box filter
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const minLat = searchParams.get('minLat')
    const maxLat = searchParams.get('maxLat')
    const minLng = searchParams.get('minLng')
    const maxLng = searchParams.get('maxLng')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: Record<string, unknown> = {}

    // Bounding box filter for map viewport
    if (minLat && maxLat && minLng && maxLng) {
      where.AND = [
        { lat: { gte: parseFloat(minLat) } },
        { lat: { lte: parseFloat(maxLat) } },
        { lng: { gte: parseFloat(minLng) } },
        { lng: { lte: parseFloat(maxLng) } },
      ]
    }

    if (userId) {
      where.userId = userId
    }

    const ratings = await db.roadRating.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ data: ratings })
  } catch (error) {
    console.error('Error fetching road ratings:', error)
    return NextResponse.json({ error: 'Failed to fetch road ratings' }, { status: 500 })
  }
}

// POST /api/road-ratings — Create a road rating
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, lat, lng, rating, surface, comment } = body

    if (!userId || lat === undefined || lng === undefined || !rating || !surface) {
      return NextResponse.json(
        { error: 'userId, lat, lng, rating, and surface are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const validSurfaces = ['asphalt', 'gravel', 'dirt', 'mixed']
    if (!validSurfaces.includes(surface)) {
      return NextResponse.json(
        { error: 'Surface must be one of: asphalt, gravel, dirt, mixed' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const roadRating = await db.roadRating.create({
      data: {
        userId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        rating: parseInt(rating),
        surface,
        comment: comment || null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ data: roadRating }, { status: 201 })
  } catch (error) {
    console.error('Error creating road rating:', error)
    return NextResponse.json({ error: 'Failed to create road rating' }, { status: 500 })
  }
}
