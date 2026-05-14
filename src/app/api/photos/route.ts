import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/photos - List photos with optional filters
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {}
    if (rideId) where.rideId = rideId
    if (routeId) where.routeId = routeId
    if (userId) where.userId = userId

    const photos = await db.photo.findMany({
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

    const total = await db.photo.count({ where })

    return NextResponse.json({
      success: true,
      data: photos,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Fetch photos error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}

// POST /api/photos - Upload a new photo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, caption, rideId, routeId, userId } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
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

    // Validate base64 size (~500KB limit)
    // Base64 is ~1.37x the original size, so 500KB base64 ≈ 365KB actual
    const MAX_BASE64_SIZE = 500 * 1024 // 500KB
    if (url.length > MAX_BASE64_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Slika je prevelika. Največja dovoljena velikost je 500KB.' },
        { status: 400 }
      )
    }

    // Validate it's a data URL
    if (!url.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: 'Veljavna slika je obvezna.' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Uporabnik ni najden' },
        { status: 404 }
      )
    }

    // Verify the ride/route exists
    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } })
      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Vožnja ni najdena' },
          { status: 404 }
        )
      }
    }

    if (routeId) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) {
        return NextResponse.json(
          { success: false, error: 'Pot ni najdena' },
          { status: 404 }
        )
      }
    }

    const photo = await db.photo.create({
      data: {
        url,
        caption: caption?.trim() || null,
        rideId: rideId || null,
        routeId: routeId || null,
        userId,
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
      { success: true, data: photo },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create photo error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}
