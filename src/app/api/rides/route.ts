import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/rides - Fetch all public rides with user info
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const friendIds = searchParams.get('friendIds')
    const where: Record<string, unknown> = { isPublic: true }
    if (userId) {
      where.userId = userId
    } else if (friendIds) {
      const ids = friendIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        where.userId = { in: ids }
      }
    }

    const rides = await db.ride.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    const total = await db.ride.count({ where })

    return NextResponse.json({
      success: true,
      data: rides,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Fetch rides error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rides' },
      { status: 500 }
    )
  }
}

// POST /api/rides - Create a new ride
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      distance,
      duration,
      avgSpeed,
      maxSpeed,
      elevation,
      trackData,
      startLat,
      startLng,
      endLat,
      endLng,
      isPublic,
      userId,
    } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Use provided userId or fall back to first user in DB
    // TODO: Add proper authentication - currently uses first user as fallback
    let rideUserId = userId
    if (!rideUserId) {
      const firstUser = await db.user.findFirst()
      if (!firstUser) {
        return NextResponse.json(
          { success: false, error: 'No users found. Please seed the database first.' },
          { status: 400 }
        )
      }
      rideUserId = firstUser.id
      console.warn('[API] POST /api/rides - No userId provided, falling back to first user:', rideUserId)
    }

    const ride = await db.ride.create({
      data: {
        title,
        description: description || null,
        distance: distance || 0,
        duration: duration || 0,
        avgSpeed: avgSpeed || 0,
        maxSpeed: maxSpeed || 0,
        elevation: elevation || 0,
        isPublic: isPublic !== undefined ? isPublic : true,
        isLive: false,
        trackData: typeof trackData === 'string' ? trackData : JSON.stringify(trackData || []),
        startLat: startLat || null,
        startLng: startLng || null,
        endLat: endLat || null,
        endLng: endLng || null,
        userId: rideUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: ride },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create ride error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create ride' },
      { status: 500 }
    )
  }
}
