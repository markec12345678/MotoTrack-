import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/feed?userId=xxx&limit=20&offset=0
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const userId = searchParams.get('userId') || undefined

    // Query SocialActivity table directly (not synthetic from rides/routes)
    const activities = await db.socialActivity.findMany({
      where: { isPublic: true },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const data = activities.map(a => ({
      id: a.id,
      userId: a.userId,
      type: a.type,
      title: a.title,
      description: a.description,
      icon: a.icon,
      targetId: a.targetId,
      targetType: a.targetType,
      isPublic: a.isPublic,
      createdAt: a.createdAt.toISOString(),
      user: { id: a.user.id, name: a.user.name, avatar: a.user.avatar },
      likes: a._count.likes,
      userLiked: userId ? a.likes.length > 0 : false,
    }))

    // If no social activities exist yet, generate from rides/routes/achievements
    if (data.length === 0) {
      const syntheticActivities: Array<Record<string, unknown>> = []

      const recentRides = await db.ride.findMany({
        where: { isPublic: true },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      for (const ride of recentRides) {
        const hours = Math.floor(ride.duration / 3600)
        const mins = Math.floor((ride.duration % 3600) / 60)
        const durStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`
        syntheticActivities.push({
          id: `ride-${ride.id}`,
          userId: ride.userId,
          type: 'ride_completed',
          title: ride.title,
          description: `${ride.distance.toFixed(1)} km · ${durStr} · ${ride.elevation.toFixed(0)} m vzpona`,
          icon: '🏍️',
          targetId: ride.id,
          targetType: 'ride',
          isPublic: true,
          createdAt: ride.createdAt.toISOString(),
          user: { id: ride.user.id, name: ride.user.name, avatar: ride.user.avatar },
          likes: 0,
          userLiked: false,
        })
      }

      const recentRoutes = await db.route.findMany({
        where: { isPublic: true },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      const catLabels: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto' }
      const diffLabels: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }

      for (const route of recentRoutes) {
        syntheticActivities.push({
          id: `route-${route.id}`,
          userId: route.userId,
          type: 'route_shared',
          title: route.title,
          description: `${route.distance.toFixed(1)} km · ${catLabels[route.category] || route.category} · ${diffLabels[route.difficulty] || route.difficulty}`,
          icon: '🗺️',
          targetId: route.id,
          targetType: 'route',
          isPublic: true,
          createdAt: route.createdAt.toISOString(),
          user: { id: route.user.id, name: route.user.name, avatar: route.user.avatar },
          likes: 0,
          userLiked: false,
        })
      }

      const recentAchievements = await db.achievement.findMany({
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { earnedAt: 'desc' },
        take: 10,
      })

      for (const ach of recentAchievements) {
        syntheticActivities.push({
          id: `ach-${ach.id}`,
          userId: ach.userId,
          type: 'achievement_earned',
          title: ach.title,
          description: ach.description,
          icon: ach.icon,
          targetId: ach.id,
          targetType: 'achievement',
          isPublic: true,
          createdAt: ach.earnedAt.toISOString(),
          user: { id: ach.user.id, name: ach.user.name, avatar: ach.user.avatar },
          likes: 0,
          userLiked: false,
        })
      }

      syntheticActivities.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())

      return NextResponse.json({
        success: true,
        data: syntheticActivities.slice(offset, offset + limit),
        total: syntheticActivities.length,
      })
    }

    return NextResponse.json({ success: true, data, total: data.length })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch feed'
    console.error('Feed error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST /api/feed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, title, description, icon, targetId, targetType, isPublic } = body

    if (!userId || !type || !title) {
      return NextResponse.json({ success: false, error: 'userId, type, and title are required' }, { status: 400 })
    }

    const activity = await db.socialActivity.create({
      data: {
        userId,
        type,
        title,
        description: description || null,
        icon: icon || '🏍️',
        targetId: targetId || null,
        targetType: targetType || null,
        isPublic: isPublic !== false,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: activity.id,
        userId: activity.userId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        icon: activity.icon,
        targetId: activity.targetId,
        targetType: activity.targetType,
        isPublic: activity.isPublic,
        createdAt: activity.createdAt.toISOString(),
        user: { id: activity.user.id, name: activity.user.name, avatar: activity.user.avatar },
        likes: 0,
        userLiked: false,
      },
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create activity'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
