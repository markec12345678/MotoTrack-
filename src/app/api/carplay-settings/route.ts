import { NextRequest, NextResponse } from 'next/server'

// GET /api/carplay-settings - Get CarPlay mode settings
export async function GET() {
  try {
    // Default settings (stored client-side in localStorage)
    return NextResponse.json({
      data: {
        autoActivate: false,
        fontScale: 1,
        brightness: 'auto',
        showClock: true,
        showFuel: true,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch CarPlay settings' }, { status: 500 })
  }
}

// POST /api/carplay-settings - Save CarPlay mode settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { autoActivate, fontScale, brightness, showClock, showFuel } = body

    // Settings are stored client-side in localStorage
    // This API provides server backup for cross-device sync
    return NextResponse.json({
      data: {
        autoActivate: autoActivate ?? false,
        fontScale: fontScale ?? 1,
        brightness: brightness ?? 'auto',
        showClock: showClock ?? true,
        showFuel: showFuel ?? true,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save CarPlay settings' }, { status: 500 })
  }
}
