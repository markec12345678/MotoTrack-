import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/rides/[id] - Fetch single ride by ID with full trackData
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const ride = await db.ride.findUnique({
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

    if (!ride) {
      return NextResponse.json(
        { success: false, error: 'Ride not found' },
        { status: 404 }
      )
    }

    // Parse trackData from JSON string
    const parsedRide = {
      ...ride,
      trackData: JSON.parse(ride.trackData),
    }

    return NextResponse.json({
      success: true,
      data: parsedRide,
    })
  } catch (error) {
    console.error('Fetch ride error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ride' },
      { status: 500 }
    )
  }
}

// PUT /api/rides/[id] - Update ride
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, isPublic } = body

    const ride = await db.ride.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    })

    return NextResponse.json({ success: true, data: ride })
  } catch (error) {
    console.error('Update ride error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ride' },
      { status: 500 }
    )
  }
}

// DELETE /api/rides/[id] - Delete ride
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete related comments first
    await db.comment.deleteMany({ where: { rideId: id } })
    await db.ride.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete ride error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete ride' },
      { status: 500 }
    )
  }
}
