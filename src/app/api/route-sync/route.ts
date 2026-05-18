import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for sync codes
// Key: sync code, Value: route data + expiry timestamp
const syncCache = new Map<string, { data: RouteSyncData; expires: number }>()

// Auto-cleanup: remove expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [code, entry] of syncCache.entries()) {
    if (now > entry.expires) {
      syncCache.delete(code)
    }
  }
}

interface RouteSyncData {
  name: string
  waypoints: Array<{ lat: number; lng: number; name?: string }>
  preferences: {
    avoidHighways: boolean
    preferTwisty: boolean
    avoidTolls: boolean
  }
  distance: number
  category?: string
  createdAt: number
}

// Generate 6-char sync code starting with "MT"
function generateSyncCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'MT'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// POST: Upload route data with sync code
export async function POST(request: NextRequest) {
  cleanup()
  try {
    const body = await request.json()
    const { name, waypoints, preferences, distance, category } = body

    if (!name || !waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json(
        { error: 'Potreben ime in vsaj dve točki' },
        { status: 400 }
      )
    }

    // Generate unique sync code
    let code = generateSyncCode()
    let attempts = 0
    while (syncCache.has(code) && attempts < 20) {
      code = generateSyncCode()
      attempts++
    }

    const expires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    const data: RouteSyncData = {
      name,
      waypoints,
      preferences: preferences || { avoidHighways: false, preferTwisty: false, avoidTolls: false },
      distance: distance || 0,
      category: category || 'scenic',
      createdAt: Date.now(),
    }

    syncCache.set(code, { data, expires })

    return NextResponse.json({
      success: true,
      code,
      expiresAt: new Date(expires).toISOString(),
    })
  } catch {
    return NextResponse.json(
      { error: 'Napaka pri nalaganju poti' },
      { status: 500 }
    )
  }
}

// GET: Retrieve route data by sync code
export async function GET(request: NextRequest) {
  cleanup()
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Potrebna koda za sinhronizacijo' },
      { status: 400 }
    )
  }

  const entry = syncCache.get(code.toUpperCase())

  if (!entry) {
    return NextResponse.json(
      { error: 'Koda ni najdena ali je potekla' },
      { status: 404 }
    )
  }

  if (Date.now() > entry.expires) {
    syncCache.delete(code.toUpperCase())
    return NextResponse.json(
      { error: 'Koda je potekla' },
      { status: 410 }
    )
  }

  // Return preview data (don't auto-delete — let user confirm download)
  return NextResponse.json({
    success: true,
    data: entry.data,
    expiresAt: new Date(entry.expires).toISOString(),
    remainingMinutes: Math.round((entry.expires - Date.now()) / 60000),
  })
}

// DELETE: Remove synced route after download
export async function DELETE(request: NextRequest) {
  cleanup()
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Potrebna koda za sinhronizacijo' },
      { status: 400 }
    )
  }

  const deleted = syncCache.delete(code.toUpperCase())

  if (!deleted) {
    return NextResponse.json(
      { error: 'Koda ni najdena' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
