import { db } from '@/lib/db'
import { notifyLike } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/routes/[id]/like - Toggle like on a route
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Verify route exists
    const route = await db.route.findUnique({ where: { id } })
    if (!route) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 }
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

    // Check if user already liked this route
    const existingLike = await db.like.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId: id,
        },
      },
    })

    if (existingLike) {
      // Unlike: remove like and decrement count
      await db.like.delete({
        where: { id: existingLike.id },
      })
      await db.route.update({
        where: { id },
        data: { likes: { decrement: 1 } },
      })
    } else {
      // Like: create like and increment count
      await db.like.create({
        data: {
          userId,
          routeId: id,
        },
      })
      await db.route.update({
        where: { id },
        data: { likes: { increment: 1 } },
      })
      // Notify route owner
      notifyLike(route.userId, userId, route.title, id).catch(() => {})
    }

    // Fetch updated route with current like status
    const updatedRoute = await db.route.findUnique({
      where: { id },
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

    // Check if current user has liked this route
    const userLiked = await db.like.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId: id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRoute,
        userLiked: !!userLiked,
      },
    })
  } catch (error) {
    console.error('Toggle like error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}
