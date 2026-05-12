import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/routes/[id] - Fetch single route by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const route = await db.route.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            bike: true,
          },
        },
      },
    })

    if (!route) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const parsedRoute = {
      ...route,
      waypoints: JSON.parse(route.waypoints),
      routeData: route.routeData ? JSON.parse(route.routeData) : null,
    }

    return NextResponse.json({
      success: true,
      data: parsedRoute,
    })
  } catch (error) {
    console.error('Fetch route error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch route' },
      { status: 500 }
    )
  }
}
