import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/settings?userId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        unitSystem: true,
        autoPauseEnabled: true,
        autoPauseSpeedThreshold: true,
        hideStartEnd: true,
        wakelockEnabled: true,
        avoidTolls: true,
        speedLimit: true,
        speedAlertEnabled: true,
        speedAlertSound: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({
      data: {
        unitSystem: user.unitSystem || 'metric',
        autoPauseEnabled: user.autoPauseEnabled ?? true,
        autoPauseSpeedThreshold: user.autoPauseSpeedThreshold ?? 5.0,
        hideStartEnd: user.hideStartEnd ?? false,
        wakelockEnabled: user.wakelockEnabled ?? true,
        avoidTolls: user.avoidTolls ?? false,
        speedLimit: user.speedLimit ?? 90,
        speedAlertEnabled: user.speedAlertEnabled ?? true,
        speedAlertSound: user.speedAlertSound ?? true,
      },
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/settings
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId, ...settings } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const allowedFields = [
      'unitSystem', 'autoPauseEnabled', 'autoPauseSpeedThreshold',
      'hideStartEnd', 'wakelockEnabled', 'avoidTolls',
      'speedLimit', 'speedAlertEnabled', 'speedAlertSound',
    ]
    const updateData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (settings[key] !== undefined) updateData[key] = settings[key]
    }

    await db.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
