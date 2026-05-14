import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/routes - Fetch all public routes with user info
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = { isPublic: true }
    if (category) {
      where.category = category
    }
    if (difficulty) {
      where.difficulty = difficulty
    }

    const routes = await db.route.findMany({
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

    const total = await db.route.count({ where })

    return NextResponse.json({
      success: true,
      data: routes,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Fetch routes error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes' },
      { status: 500 }
    )
  }
}

// POST /api/routes - Create a new route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      distance,
      waypoints,
      routeData,
      category,
      difficulty,
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
    let routeUserId = userId
    if (!routeUserId) {
      const firstUser = await db.user.findFirst()
      if (!firstUser) {
        return NextResponse.json(
          { success: false, error: 'No users found. Please seed the database first.' },
          { status: 400 }
        )
      }
      routeUserId = firstUser.id
      console.warn('[API] POST /api/routes - No userId provided, falling back to first user:', routeUserId)
    }

    const route = await db.route.create({
      data: {
        title,
        description: description || null,
        distance: distance || 0,
        waypoints: typeof waypoints === 'string' ? waypoints : JSON.stringify(waypoints || []),
        routeData: routeData
          ? typeof routeData === 'string'
            ? routeData
            : JSON.stringify(routeData)
          : null,
        category: category || 'scenic',
        difficulty: difficulty || 'medium',
        isPublic: isPublic !== undefined ? isPublic : true,
        likes: 0,
        userId: routeUserId,
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
      { success: true, data: route },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create route error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create route' },
      { status: 500 }
    )
  }
}
