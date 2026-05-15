import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RideCardBody {
  rideTitle: string
  distance: number
  duration: number
  maxSpeed: number
  avgSpeed: number
  elevation: number
  category?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: RideCardBody = await req.json()
    const {
      rideTitle,
      distance,
      duration,
      maxSpeed,
      avgSpeed,
      elevation,
      category,
    } = body

    // Validate required fields
    if (!rideTitle || typeof rideTitle !== 'string') {
      return NextResponse.json(
        { error: 'rideTitle is required and must be a string' },
        { status: 400 }
      )
    }

    if (typeof distance !== 'number' || distance < 0) {
      return NextResponse.json(
        { error: 'distance must be a non-negative number' },
        { status: 400 }
      )
    }

    if (typeof duration !== 'number' || duration < 0) {
      return NextResponse.json(
        { error: 'duration must be a non-negative number' },
        { status: 400 }
      )
    }

    if (typeof maxSpeed !== 'number' || maxSpeed < 0) {
      return NextResponse.json(
        { error: 'maxSpeed must be a non-negative number' },
        { status: 400 }
      )
    }

    if (typeof avgSpeed !== 'number' || avgSpeed < 0) {
      return NextResponse.json(
        { error: 'avgSpeed must be a non-negative number' },
        { status: 400 }
      )
    }

    if (typeof elevation !== 'number') {
      return NextResponse.json(
        { error: 'elevation must be a number' },
        { status: 400 }
      )
    }

    // Build the image generation prompt
    const categoryLabel = category || 'road'
    const prompt = [
      'Professional motorcycle ride summary card for social media sharing.',
      `Ride title: "${rideTitle}"`,
      `Distance: ${distance.toFixed(1)} km | Duration: ${Math.floor(duration / 60)}h ${duration % 60}m`,
      `Max speed: ${maxSpeed.toFixed(0)} km/h | Avg speed: ${avgSpeed.toFixed(0)} km/h`,
      `Elevation gain: ${elevation.toFixed(0)} m`,
      `Category: ${categoryLabel}`,
      'Design: Mountain road aesthetic with winding curves and scenic landscape.',
      'Orange and amber color scheme with dark accents.',
      'Include motorcycle iconography: helmet, speedometer, mountain silhouette.',
      'Clean, modern typography. Stats displayed in a grid layout.',
      'High quality, social media ready, 16:9 aspect ratio.',
    ].join(' ')

    // Dynamically import z-ai-web-dev-sdk (backend only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Generate ride card image
    const response = await zai.images.generations.create({
      prompt,
      size: '1344x768',
    })

    // Extract base64 image
    const imageBase64 = response.data[0].base64

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Failed to generate ride card image' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imageBase64,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ride card generation failed'
    console.error('[Ride Card API] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
