import { NextResponse } from 'next/server'

// In-memory cache for tracking diagnostics (session-scoped)
let latestDiagnostics: Record<string, unknown> | null = null

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const {
      duration,
      totalPoints,
      droppedPoints,
      reconnections,
      suspiciousPoints,
      errorCount,
      signalQuality,
      finalAccuracy,
      wakeLockUsed,
      timestamp,
    } = body

    // Store diagnostics in memory
    latestDiagnostics = {
      duration: typeof duration === 'number' ? duration : 0,
      totalPoints: typeof totalPoints === 'number' ? totalPoints : 0,
      droppedPoints: typeof droppedPoints === 'number' ? droppedPoints : 0,
      reconnections: typeof reconnections === 'number' ? reconnections : 0,
      suspiciousPoints: typeof suspiciousPoints === 'number' ? suspiciousPoints : 0,
      errorCount: typeof errorCount === 'number' ? errorCount : 0,
      signalQuality: typeof signalQuality === 'string' ? signalQuality : 'unknown',
      finalAccuracy: typeof finalAccuracy === 'number' ? finalAccuracy : null,
      wakeLockUsed: typeof wakeLockUsed === 'boolean' ? wakeLockUsed : false,
      timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    }

    // Calculate reliability score (0-100)
    const totalDataPoints = latestDiagnostics.totalPoints as number + (latestDiagnostics.droppedPoints as number)
    const pointRetentionRate = totalDataPoints > 0
      ? (((totalDataPoints - (latestDiagnostics.droppedPoints as number)) / totalDataPoints) * 100)
      : 100
    const reconnectionPenalty = Math.min((latestDiagnostics.reconnections as number) * 5, 30)
    const errorPenalty = Math.min((latestDiagnostics.errorCount as number) * 2, 20)
    const suspiciousPenalty = Math.min((latestDiagnostics.suspiciousPoints as number) * 1, 10)
    const reliabilityScore = Math.max(0, Math.min(100, pointRetentionRate - reconnectionPenalty - errorPenalty - suspiciousPenalty))

    latestDiagnostics.reliabilityScore = Math.round(reliabilityScore)

    // Signal quality score
    const qualityScores: Record<string, number> = {
      excellent: 100,
      good: 80,
      fair: 60,
      poor: 30,
      none: 0,
      unknown: 50,
    }
    latestDiagnostics.signalScore = qualityScores[latestDiagnostics.signalQuality as string] ?? 50

    return NextResponse.json({
      success: true,
      data: latestDiagnostics,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Neveljavni podatki diagnostike' },
      { status: 400 }
    )
  }
}

export async function GET() {
  if (!latestDiagnostics) {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'Ni razpoložljivih diagnostičnih podatkov',
    })
  }

  return NextResponse.json({
    success: true,
    data: latestDiagnostics,
  })
}
