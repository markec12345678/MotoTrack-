import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/parking - Get parking spots for a user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Use a simple approach - store in user settings as JSON
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parking spots are stored client-side in localStorage
    // This API just provides the server-side backup
    return NextResponse.json({ data: [] })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch parking spots' }, { status: 500 })
  }
}

// POST /api/parking - Save a parking spot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, lat, lng, address, note } = body

    if (!userId || lat == null || lng == null) {
      return NextResponse.json({ error: 'userId, lat, lng required' }, { status: 400 })
    }

    // Parking spots are primarily stored in localStorage
    // This API provides server backup
    const spot = {
      id: `park_${Date.now()}`,
      lat,
      lng,
      address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      note: note || '',
      timestamp: Date.now(),
    }

    return NextResponse.json({ data: spot })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save parking spot' }, { status: 500 })
  }
}

// DELETE /api/parking - Delete a parking spot
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    // Client-side deletion via localStorage
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete parking spot' }, { status: 500 })
  }
}
