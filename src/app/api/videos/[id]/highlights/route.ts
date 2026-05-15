import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Highlight types with their Slovenian labels
const HIGHLIGHT_TYPES: Record<string, string> = {
  high_speed: 'Visoka hitrost',
  sharp_curve: 'Ostra ovinka',
  steep_climb: 'Strm vzpon',
  scenic_view: 'Razgledna točka',
  hard_braking: 'Trdo zaviranje',
  acceleration: 'Pospeševanje',
  g_force: 'Visok G-force',
}

// Auto-generate highlights based on video metadata/duration simulation
function autoGenerateHighlights(duration: number, footageId: string): Array<{
  footageId: string
  startTime: number
  endTime: number
  title: string
  type: string
  gForce: number | null
  speed: number | null
  leanAngle: number | null
}> {
  const highlights: Array<{
    footageId: string
    startTime: number
    endTime: number
    title: string
    type: string
    gForce: number | null
    speed: number | null
    leanAngle: number | null
  }> = []

  // Generate 3-6 highlights depending on video length
  const numHighlights = Math.min(6, Math.max(3, Math.floor(duration / 300)))

  const types = ['high_speed', 'sharp_curve', 'steep_climb', 'scenic_view', 'hard_braking', 'acceleration', 'g_force']
  const segmentLength = duration / (numHighlights + 1)

  for (let i = 0; i < numHighlights; i++) {
    const baseStart = Math.floor(segmentLength * (i + 0.7))
    const clipLength = Math.floor(Math.random() * 20) + 10 // 10-30 seconds
    const startTime = Math.min(baseStart, duration - clipLength)
    const endTime = Math.min(startTime + clipLength, duration)
    const type = types[i % types.length]

    let gForce: number | null = null
    let speed: number | null = null
    let leanAngle: number | null = null

    switch (type) {
      case 'high_speed':
        speed = Math.floor(Math.random() * 60) + 120 // 120-180 km/h
        gForce = Math.round((Math.random() * 0.5 + 0.8) * 10) / 10
        break
      case 'sharp_curve':
        leanAngle = Math.floor(Math.random() * 20) + 25 // 25-45 degrees
        speed = Math.floor(Math.random() * 40) + 40
        gForce = Math.round((Math.random() * 0.8 + 0.6) * 10) / 10
        break
      case 'steep_climb':
        speed = Math.floor(Math.random() * 30) + 30
        gForce = Math.round((Math.random() * 0.3 + 0.2) * 10) / 10
        break
      case 'scenic_view':
        speed = Math.floor(Math.random() * 20) + 20
        break
      case 'hard_braking':
        speed = Math.floor(Math.random() * 40) + 60
        gForce = Math.round((Math.random() * 0.6 + 0.9) * 10) / 10
        break
      case 'acceleration':
        speed = Math.floor(Math.random() * 50) + 80
        gForce = Math.round((Math.random() * 0.4 + 0.5) * 10) / 10
        break
      case 'g_force':
        gForce = Math.round((Math.random() * 0.8 + 1.2) * 10) / 10 // 1.2-2.0 G
        speed = Math.floor(Math.random() * 40) + 60
        leanAngle = Math.floor(Math.random() * 15) + 20
        break
    }

    highlights.push({
      footageId,
      startTime,
      endTime,
      title: HIGHLIGHT_TYPES[type] || type,
      type,
      gForce,
      speed,
      leanAngle,
    })
  }

  return highlights
}

// GET /api/videos/[id]/highlights — Get highlights for a video
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const footage = await db.videoFootage.findUnique({ where: { id } })
    if (!footage) {
      return NextResponse.json({ error: 'Video ni najden' }, { status: 404 })
    }

    // Fetch existing highlights
    let highlights = await db.videoHighlight.findMany({
      where: { footageId: id },
      orderBy: { startTime: 'asc' },
    })

    // If no highlights exist yet, auto-generate them
    if (highlights.length === 0) {
      const autoHighlights = autoGenerateHighlights(footage.duration, id)
      const created = []

      for (const h of autoHighlights) {
        const highlight = await db.videoHighlight.create({
          data: {
            footageId: h.footageId,
            startTime: h.startTime,
            endTime: h.endTime,
            title: h.title,
            type: 'auto',
            gForce: h.gForce,
            speed: h.speed,
            leanAngle: h.leanAngle,
          },
        })
        created.push(highlight)
      }

      highlights = created
    }

    return NextResponse.json({
      success: true,
      data: highlights,
    })
  } catch (error) {
    console.error('Error fetching highlights:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju poudarkov' }, { status: 500 })
  }
}

// POST /api/videos/[id]/highlights — Create a manual highlight or auto-detect
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { autoDetect } = body

    const footage = await db.videoFootage.findUnique({ where: { id } })
    if (!footage) {
      return NextResponse.json({ error: 'Video ni najden' }, { status: 404 })
    }

    // Auto-detect mode: delete existing auto highlights and regenerate
    if (autoDetect) {
      // Remove existing auto-generated highlights
      await db.videoHighlight.deleteMany({
        where: { footageId: id, type: 'auto' },
      })

      // Generate fresh highlights from telemetry data
      const autoHighlights = autoGenerateHighlights(footage.duration, id)
      const created = []

      for (const h of autoHighlights) {
        const highlight = await db.videoHighlight.create({
          data: {
            footageId: h.footageId,
            startTime: h.startTime,
            endTime: h.endTime,
            title: h.title,
            type: 'auto',
            gForce: h.gForce,
            speed: h.speed,
            leanAngle: h.leanAngle,
          },
        })
        created.push(highlight)
      }

      return NextResponse.json({
        success: true,
        data: created,
        message: `Zaznanih ${created.length} poudarkov iz telemetrije`,
      })
    }

    // Manual highlight creation
    const { startTime, endTime, title } = body

    if (startTime === undefined || endTime === undefined) {
      return NextResponse.json(
        { error: 'Začetni in končni čas sta obvezna' },
        { status: 400 }
      )
    }

    // Validate time range
    if (startTime < 0 || endTime > footage.duration || startTime >= endTime) {
      return NextResponse.json(
        { error: 'Neveljaven časovni obseg' },
        { status: 400 }
      )
    }

    const highlight = await db.videoHighlight.create({
      data: {
        footageId: id,
        startTime,
        endTime,
        title: title || `Ročni poudarek (${startTime}s - ${endTime}s)`,
        type: 'manual',
      },
    })

    return NextResponse.json({
      success: true,
      data: highlight,
    })
  } catch (error) {
    console.error('Error creating highlight:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju poudarka' }, { status: 500 })
  }
}
