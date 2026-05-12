import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/rides/[id] - Fetch single ride by ID with full trackData
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
