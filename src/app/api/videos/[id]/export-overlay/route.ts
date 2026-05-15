import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/videos/[id]/export-overlay — Simulate video export with telemetry overlay
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const footage = await db.videoFootage.findUnique({ where: { id } })
    if (!footage) {
      return NextResponse.json({ error: 'Video ni najden' }, { status: 404 })
    }

    if (footage.status !== 'ready') {
      return NextResponse.json(
        { error: 'Video mora biti v statusu "Pripravljen" za izvoz' },
        { status: 400 }
      )
    }

    // Simulate export — in reality this would render the video with overlay
    // Return export details and simulated progress
    const estimatedDuration = Math.ceil(footage.duration / 60) // 1 minute per 1 minute of video
    const fileSizeMB = Math.round((footage.fileSize / (1024 * 1024)) * 1.15) // ~15% larger with overlay

    return NextResponse.json({
      success: true,
      data: {
        videoId: id,
        fileName: footage.fileName.replace('.mp4', '_overlay.mp4'),
        originalSize: footage.fileSize,
        estimatedSize: fileSizeMB * 1024 * 1024,
        duration: footage.duration,
        estimatedProcessingTime: estimatedDuration * 60, // seconds
        overlays: ['speed', 'altitude', 'lean_angle', 'g_force', 'distance'],
        status: 'processing',
        progress: 0,
      },
    })
  } catch (error) {
    console.error('Error starting export:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu videa' }, { status: 500 })
  }
}
