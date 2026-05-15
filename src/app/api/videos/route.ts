import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/videos?userId=xxx&rideId=yyy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const rideId = searchParams.get('rideId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (rideId) {
      where.rideId = rideId
    }

    const videos = await db.videoFootage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const data = videos.map(v => ({
      ...v,
      metadata: v.metadata ? JSON.parse(v.metadata) : null,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching videos:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}

// POST /api/videos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, rideId, fileName, fileSize, duration, gpsTrackOffset, metadata } = body

    if (!userId || !fileName || !fileSize || !duration) {
      return NextResponse.json(
        { error: 'userId, fileName, fileSize, and duration are required' },
        { status: 400 }
      )
    }

    // Auto-generate a thumbnail description based on metadata
    const metaObj = metadata || {}
    const cameraModel = (metaObj.cameraModel as string) || (metaObj.camera as string) || 'Neznana kamera'
    const resolution = (metaObj.resolution as string) || ''
    const thumbnailDesc = `${cameraModel}${resolution ? ` ${resolution}` : ''} - ${fileName}`

    const video = await db.videoFootage.create({
      data: {
        userId,
        rideId: rideId || null,
        fileName,
        fileSize,
        duration,
        gpsTrackOffset: gpsTrackOffset ?? 0,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'processing',
        recordedAt: new Date(),
        thumbnailUrl: thumbnailDesc,
      },
    })

    return NextResponse.json({
      data: {
        ...video,
        metadata: video.metadata ? JSON.parse(video.metadata) : null,
      },
    })
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })
  }
}
