import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/videos/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const video = await db.videoFootage.findUnique({ where: { id } })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...video,
        metadata: video.metadata ? JSON.parse(video.metadata) : null,
      },
    })
  } catch (error) {
    console.error('Error fetching video:', error)
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 })
  }
}

// PUT /api/videos/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, gpsTrackOffset } = body

    const existing = await db.videoFootage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (gpsTrackOffset !== undefined) updateData.gpsTrackOffset = gpsTrackOffset

    const video = await db.videoFootage.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      data: {
        ...video,
        metadata: video.metadata ? JSON.parse(video.metadata) : null,
      },
    })
  } catch (error) {
    console.error('Error updating video:', error)
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 })
  }
}

// DELETE /api/videos/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.videoFootage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    await db.videoFootage.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }
}
