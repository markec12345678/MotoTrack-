import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Generate a random 6-character alphanumeric share code
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I,O,0,1 to avoid confusion
  let code = 'MT' // MotoTrack prefix
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * POST /api/routes/share — Generate a share code for a route
 * Body: { routeId: string, userId?: string }
 * Returns: { data: { shareCode: string, shareUrl: string } }
 */
export async function POST(request: NextRequest) {
  try {
    const { routeId, userId } = await request.json()
    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 })
    }

    // Check if route exists
    const route = await db.route.findUnique({ where: { id: routeId } })
    if (!route) {
      return NextResponse.json({ error: 'Ruta ni najdena' }, { status: 404 })
    }

    // If route already has a share code, return it
    if (route.shareCode) {
      const shareUrl = `https://mototrack-gamma.vercel.app/?route=${route.shareCode}`
      return NextResponse.json({
        data: { shareCode: route.shareCode, shareUrl }
      })
    }

    // Generate unique share code (retry if collision)
    let shareCode = generateShareCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.route.findFirst({ where: { shareCode } })
      if (!existing) break
      shareCode = generateShareCode()
      attempts++
    }

    // Update route with share code
    await db.route.update({
      where: { id: routeId },
      data: { shareCode }
    })

    const shareUrl = `https://mototrack-gamma.vercel.app/?route=${shareCode}`
    return NextResponse.json({
      data: { shareCode, shareUrl }
    })
  } catch (error: unknown) {
    console.error('[Routes/Share] Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri deljenju rute' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/routes/share?code=MT3K7X — Look up a route by share code
 * Returns: { data: { title, waypoints, distance, category, difficulty, description, shareCode } }
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json({ error: 'Parameter "code" je obvezen' }, { status: 400 })
    }

    // Case-insensitive lookup (SQLite is case-insensitive by default for ASCII)
    const route = await db.route.findFirst({
      where: { shareCode: code.toUpperCase() },
      select: {
        id: true,
        title: true,
        description: true,
        distance: true,
        waypoints: true,
        category: true,
        difficulty: true,
        shareCode: true,
        createdAt: true,
        user: { select: { name: true, bike: true } }
      }
    })

    if (!route) {
      return NextResponse.json({ error: 'Ruta s to kodo ni najdena' }, { status: 404 })
    }

    return NextResponse.json({ data: route })
  } catch (error: unknown) {
    console.error('[Routes/Share] Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri iskanju rute' },
      { status: 500 }
    )
  }
}
