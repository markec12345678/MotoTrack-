import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/favorites?userId=xxx&type=ride|route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const favorites = await db.favorite.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, avatar: true, bike: true } },
        ride: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        route: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter by type if specified
    const filtered = type === 'ride'
      ? favorites.filter(f => f.rideId !== null)
      : type === 'route'
        ? favorites.filter(f => f.routeId !== null)
        : favorites

    const data = filtered.map(fav => ({
      id: fav.id,
      userId: fav.userId,
      rideId: fav.rideId,
      routeId: fav.routeId,
      createdAt: fav.createdAt.toISOString(),
      ride: fav.ride ? {
        id: fav.ride.id,
        title: fav.ride.title,
        description: fav.ride.description,
        distance: fav.ride.distance,
        duration: fav.ride.duration,
        avgSpeed: fav.ride.avgSpeed,
        maxSpeed: fav.ride.maxSpeed,
        elevation: fav.ride.elevation,
        startLat: fav.ride.startLat,
        startLng: fav.ride.startLng,
        endLat: fav.ride.endLat,
        endLng: fav.ride.endLng,
        isPublic: fav.ride.isPublic,
        trackData: fav.ride.trackData,
        createdAt: fav.ride.createdAt.toISOString(),
        user: fav.ride.user,
      } : null,
      route: fav.route ? {
        id: fav.route.id,
        title: fav.route.title,
        description: fav.route.description,
        distance: fav.route.distance,
        category: fav.route.category,
        difficulty: fav.route.difficulty,
        isPublic: fav.route.isPublic,
        likes: fav.route.likes,
        waypoints: fav.route.waypoints,
        routeData: fav.route.routeData,
        createdAt: fav.route.createdAt.toISOString(),
        user: fav.route.user,
      } : null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Fetch favorites error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch favorites' }, { status: 500 })
  }
}

// POST /api/favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, rideId, routeId } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }
    if (!rideId && !routeId) {
      return NextResponse.json({ success: false, error: 'rideId or routeId is required' }, { status: 400 })
    }

    // Check for existing favorite
    const existing = await db.favorite.findFirst({
      where: { userId, rideId: rideId ?? null, routeId: routeId ?? null },
    })

    if (existing) {
      return NextResponse.json({ success: false, error: 'Already favorited' }, { status: 409 })
    }

    const favorite = await db.favorite.create({
      data: { userId, rideId: rideId ?? null, routeId: routeId ?? null },
    })

    return NextResponse.json({
      success: true,
      data: { id: favorite.id, userId: favorite.userId, rideId: favorite.rideId, routeId: favorite.routeId, createdAt: favorite.createdAt.toISOString() },
    }, { status: 201 })
  } catch (error) {
    console.error('Create favorite error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create favorite' }, { status: 500 })
  }
}

// DELETE /api/favorites
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, rideId, routeId } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }
    if (!rideId && !routeId) {
      return NextResponse.json({ success: false, error: 'rideId or routeId is required' }, { status: 400 })
    }

    const favorite = await db.favorite.findFirst({
      where: { userId, rideId: rideId ?? null, routeId: routeId ?? null },
    })

    if (!favorite) {
      return NextResponse.json({ success: false, error: 'Favorite not found' }, { status: 404 })
    }

    await db.favorite.delete({ where: { id: favorite.id } })

    return NextResponse.json({ success: true, data: { id: favorite.id, deleted: true } })
  } catch (error) {
    console.error('Delete favorite error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete favorite' }, { status: 500 })
  }
}
