import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/comments - List comments filtered by rideId or routeId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!rideId && !routeId) {
      return NextResponse.json(
        { success: false, error: 'Provide either rideId or routeId query parameter' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (rideId) where.rideId = rideId
    if (routeId) where.routeId = routeId

    const comments = await db.comment.findMany({
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

    const total = await db.comment.count({ where })

    return NextResponse.json({
      success: true,
      data: comments,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Fetch comments error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/comments - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, userId, rideId, routeId } = body

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Comment text is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!rideId && !routeId) {
      return NextResponse.json(
        { success: false, error: 'Provide either rideId or routeId' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify the target (ride or route) exists
    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } })
      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Ride not found' },
          { status: 404 }
        )
      }
    }

    if (routeId) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) {
        return NextResponse.json(
          { success: false, error: 'Route not found' },
          { status: 404 }
        )
      }
    }

    const comment = await db.comment.create({
      data: {
        text: text.trim(),
        userId,
        rideId: rideId || null,
        routeId: routeId || null,
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
      { success: true, data: comment },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
