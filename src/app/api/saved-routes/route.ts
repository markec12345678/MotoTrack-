import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET: List user's saved routes
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default'

    const savedRoutes = await db.savedRoute.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    const routes = savedRoutes.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      waypoints: JSON.parse(r.waypoints),
      preferences: JSON.parse(r.preferences),
      distance: r.distance,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json({ success: true, data: routes })
  } catch {
    return NextResponse.json(
      { error: 'Napaka pri pridobivanju shranjenih poti' },
      { status: 500 }
    )
  }
}

// POST: Save a new route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, waypoints, preferences, userId, distance } = body

    if (!name || !waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json(
        { error: 'Potreben ime in vsaj dve točki' },
        { status: 400 }
      )
    }

    const savedRoute = await db.savedRoute.create({
      data: {
        name,
        description: description || null,
        waypoints: JSON.stringify(waypoints),
        preferences: JSON.stringify(preferences || { avoidHighways: false, preferTwisty: false, avoidTolls: false }),
        userId: userId || 'default',
        distance: distance || 0,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: savedRoute.id,
        name: savedRoute.name,
        description: savedRoute.description,
        waypoints: JSON.parse(savedRoute.waypoints),
        preferences: JSON.parse(savedRoute.preferences),
        distance: savedRoute.distance,
        createdAt: savedRoute.createdAt,
        updatedAt: savedRoute.updatedAt,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Napaka pri shranjevanju poti' },
      { status: 500 }
    )
  }
}

// PUT: Update a saved route
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, waypoints, preferences, distance } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Potreben ID poti' },
        { status: 400 }
      )
    }

    const existing = await db.savedRoute.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Pot ni najdena' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (waypoints !== undefined) updateData.waypoints = JSON.stringify(waypoints)
    if (preferences !== undefined) updateData.preferences = JSON.stringify(preferences)
    if (distance !== undefined) updateData.distance = distance

    const savedRoute = await db.savedRoute.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: savedRoute.id,
        name: savedRoute.name,
        description: savedRoute.description,
        waypoints: JSON.parse(savedRoute.waypoints),
        preferences: JSON.parse(savedRoute.preferences),
        distance: savedRoute.distance,
        createdAt: savedRoute.createdAt,
        updatedAt: savedRoute.updatedAt,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Napaka pri posodabljanju poti' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a saved route
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Potreben ID poti' },
        { status: 400 }
      )
    }

    const existing = await db.savedRoute.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Pot ni najdena' },
        { status: 404 }
      )
    }

    await db.savedRoute.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Napaka pri brisanju poti' },
      { status: 500 }
    )
  }
}
