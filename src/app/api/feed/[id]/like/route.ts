import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/feed/[id]/like - Toggle like on a social activity
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

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if the activity exists in the SocialActivity table
    const activity = await db.socialActivity.findUnique({ where: { id } })

    // If the activity doesn't exist in the DB, it's an auto-generated one
    // We need to create it first so we can like it
    if (!activity) {
      // Auto-generated activities use IDs like "ride-xxx", "route-xxx", "achievement-xxx"
      // We need to find the actual entity and create a SocialActivity for it
      let createdActivity: { id: string; createdAt: Date; title: string; description: string | null; isPublic: boolean; userId: string; type: string; icon: string; targetId: string | null; targetType: string | null } | null = null

      if (id.startsWith('ride-')) {
        const rideId = id.replace('ride-', '')
        const ride = await db.ride.findUnique({
          where: { id: rideId },
          include: { user: { select: { id: true, name: true } } },
        })
        if (ride) {
          createdActivity = await db.socialActivity.create({
            data: {
              userId: ride.userId,
              type: 'ride_completed',
              title: ride.title,
              description: `${ride.distance.toFixed(1)} km · ${ride.duration ? Math.floor(ride.duration / 60) : 0} min`,
              icon: '🏍️',
              targetId: ride.id,
              targetType: 'ride',
              isPublic: ride.isPublic,
            },
          })
        }
      } else if (id.startsWith('route-')) {
        const routeId = id.replace('route-', '')
        const route = await db.route.findUnique({
          where: { id: routeId },
          include: { user: { select: { id: true, name: true } } },
        })
        if (route) {
          createdActivity = await db.socialActivity.create({
            data: {
              userId: route.userId,
              type: 'route_shared',
              title: route.title,
              description: `${route.distance.toFixed(1)} km · ${route.category}`,
              icon: '🗺️',
              targetId: route.id,
              targetType: 'route',
              isPublic: route.isPublic,
            },
          })
        }
      } else if (id.startsWith('achievement-')) {
        const achievementId = id.replace('achievement-', '')
        const achievement = await db.achievement.findUnique({
          where: { id: achievementId },
          include: { user: { select: { id: true, name: true } } },
        })
        if (achievement) {
          createdActivity = await db.socialActivity.create({
            data: {
              userId: achievement.userId,
              type: 'achievement_earned',
              title: achievement.title,
              description: achievement.description,
              icon: achievement.icon,
              targetId: achievement.id,
              targetType: 'achievement',
            },
          })
        }
      }

      if (!createdActivity) {
        return NextResponse.json(
          { success: false, error: 'Activity not found' },
          { status: 404 }
        )
      }

      // Now toggle the like on the newly created activity
      const existingLike = await db.activityLike.findUnique({
        where: {
          userId_activityId: {
            userId,
            activityId: createdActivity.id,
          },
        },
      })

      let liked: boolean

      if (existingLike) {
        await db.activityLike.delete({ where: { id: existingLike.id } })
        liked = false
      } else {
        await db.activityLike.create({
          data: { userId, activityId: createdActivity.id },
        })
        liked = true
      }

      const likesCount = await db.activityLike.count({
        where: { activityId: createdActivity.id },
      })

      return NextResponse.json({
        success: true,
        data: { liked, likesCount },
      })
    }

    // Activity exists in DB — toggle like directly
    const existingLike = await db.activityLike.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId: id,
        },
      },
    })

    let liked: boolean

    if (existingLike) {
      await db.activityLike.delete({ where: { id: existingLike.id } })
      liked = false
    } else {
      await db.activityLike.create({
        data: { userId, activityId: id },
      })
      liked = true
    }

    const likesCount = await db.activityLike.count({
      where: { activityId: id },
    })

    return NextResponse.json({
      success: true,
      data: { liked, likesCount },
    })
  } catch (error) {
    console.error('Toggle activity like error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}
