import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/feed?userId=xxx&limit=20&offset=0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const activities: Array<Record<string, unknown>> = []

    // Get recent rides
    const recentRides = await db.ride.findMany({
      where: { isPublic: true },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    for (const ride of recentRides) {
      const hours = Math.floor(ride.duration / 3600)
      const mins = Math.floor((ride.duration % 3600) / 60)
      const durStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`
      activities.push({
        id: `ride-${ride.id}`,
        userId: ride.userId,
        type: 'ride_completed',
        title: ride.title,
        description: `${ride.distance.toFixed(1)} km · ${durStr} · ${ride.elevation.toFixed(0)} m vzpona`,
        icon: '🏍️',
        targetId: ride.id,
        targetType: 'ride',
        createdAt: ride.createdAt.toISOString(),
        user: { name: ride.user.name, avatar: ride.user.avatar },
        likes: 0,
        userLiked: false,
      })
    }

    // Get recent routes
    const recentRoutes = await db.route.findMany({
      where: { isPublic: true },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const catLabels: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto' }
    const diffLabels: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }

    for (const route of recentRoutes) {
      activities.push({
        id: `route-${route.id}`,
        userId: route.userId,
        type: 'route_shared',
        title: route.title,
        description: `${route.distance.toFixed(1)} km · ${catLabels[route.category] || route.category} · ${diffLabels[route.difficulty] || route.difficulty}`,
        icon: '🗺️',
        targetId: route.id,
        targetType: 'route',
        createdAt: route.createdAt.toISOString(),
        user: { name: route.user.name, avatar: route.user.avatar },
        likes: 0,
        userLiked: false,
      })
    }

    // Get recent achievements
    const recentAchievements = await db.achievement.findMany({
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { earnedAt: 'desc' },
      take: 20,
    })

    for (const ach of recentAchievements) {
      activities.push({
        id: `ach-${ach.id}`,
        userId: ach.userId,
        type: 'achievement_earned',
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        targetId: ach.id,
        targetType: 'achievement',
        createdAt: ach.earnedAt.toISOString(),
        user: { name: ach.user.name, avatar: ach.user.avatar },
        likes: 0,
        userLiked: false,
      })
    }

    // Sort by createdAt desc
    activities.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())

    const total = activities.length
    const paginated = activities.slice(offset, offset + limit)

    return NextResponse.json({ success: true, data: paginated, total })
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
        likes: { select: { id: true } },
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
        user: activity.user,
        likes: 0,
        userLiked: false,
      },
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create activity'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
