import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/share?type=ride|route&id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json({ success: false, error: 'type and id are required' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const shareUrl = `${protocol}://${host}/api/share?type=${type}&id=${id}`

    if (type === 'ride') {
      const ride = await db.ride.findUnique({
        where: { id },
        include: { user: { select: { name: true, avatar: true } } },
      })
      if (!ride) {
        return NextResponse.json({ success: false, error: 'Ride not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: { title: ride.title, distance: ride.distance, elevation: ride.elevation, user: ride.user, createdAt: ride.createdAt.toISOString(), shareUrl },
      })
    }

    if (type === 'route') {
      const route = await db.route.findUnique({
        where: { id },
        include: { user: { select: { name: true, avatar: true } } },
      })
      if (!route) {
        return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: { title: route.title, distance: route.distance, elevation: 0, category: route.category, user: route.user, createdAt: route.createdAt.toISOString(), shareUrl },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get share data'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST /api/share - Share a ride/route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, userId, platform } = body

    if (!type || !id) {
      return NextResponse.json({ success: false, error: 'type and id are required' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const shareUrl = `${protocol}://${host}/api/share?type=${type}&id=${id}`

    // Create a social activity for the share
    let socialActivity = null
    if (userId) {
      try {
        socialActivity = await db.socialActivity.create({
          data: {
            userId,
            type: 'route_shared',
            title: `Deljeno: ${type === 'ride' ? 'vožnja' : 'pot'}`,
            description: platform ? `Deljeno preko ${platform}` : null,
            icon: '🔗',
            targetId: id,
            targetType: type,
            isPublic: true,
          },
        })
      } catch {
        // Social activity creation is optional
      }
    }

    return NextResponse.json({
      success: true,
      shareUrl,
      socialActivity: socialActivity ? {
        id: socialActivity.id,
        type: socialActivity.type,
        title: socialActivity.title,
        createdAt: socialActivity.createdAt.toISOString(),
      } : null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to share'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
