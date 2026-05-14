import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/events/[id] - Get single event by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const event = await db.motoEvent.findUnique({
      where: { id },
    })

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: event,
    })
  } catch (error) {
    console.error('Fetch event error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

// DELETE /api/events/[id] - Delete event by ID
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const event = await db.motoEvent.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    await db.motoEvent.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
    })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
