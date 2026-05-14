import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/routes/[id] - Fetch single route by ID
export const dynamic = 'force-dynamic'

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

// PUT /api/routes/[id] - Update route
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, category, difficulty, isPublic } = body

    const route = await db.route.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(difficulty !== undefined && { difficulty }),
        ...(isPublic !== undefined && { isPublic }),
      },
    })

    return NextResponse.json({ success: true, data: route })
  } catch (error) {
    console.error('Update route error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update route' },
      { status: 500 }
    )
  }
}

// DELETE /api/routes/[id] - Delete route
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete related data first
    await db.comment.deleteMany({ where: { routeId: id } })
    await db.like.deleteMany({ where: { routeId: id } })
    await db.route.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete route error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete route' },
      { status: 500 }
    )
  }
}
