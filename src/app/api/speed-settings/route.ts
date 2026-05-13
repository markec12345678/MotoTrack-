import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        data: {
          speedLimit: 90,
          speedAlertEnabled: true,
          speedAlertSound: true,
        },
      })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        speedLimit: true,
        speedAlertEnabled: true,
        speedAlertSound: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        speedLimit: user.speedLimit ?? 90,
        speedAlertEnabled: user.speedAlertEnabled ?? true,
        speedAlertSound: user.speedAlertSound ?? true,
      },
    })
  } catch (error) {
    console.error('Speed settings GET error:', error)
    return NextResponse.json({ error: 'Napaka strežnika' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, speedLimit, speedAlertEnabled, speedAlertSound } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId je obvezen' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof speedLimit === 'number' && speedLimit >= 30 && speedLimit <= 200) {
      updateData.speedLimit = speedLimit
    }
    if (typeof speedAlertEnabled === 'boolean') {
      updateData.speedAlertEnabled = speedAlertEnabled
    }
    if (typeof speedAlertSound === 'boolean') {
      updateData.speedAlertSound = speedAlertSound
    }

    if (Object.keys(updateData).length > 0) {
      await db.user.update({
        where: { id: userId },
        data: updateData,
      })
    }

    // Return updated settings
    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        speedLimit: true,
        speedAlertEnabled: true,
        speedAlertSound: true,
      },
    })

    return NextResponse.json({
      data: {
        speedLimit: updatedUser!.speedLimit ?? 90,
        speedAlertEnabled: updatedUser!.speedAlertEnabled ?? true,
        speedAlertSound: updatedUser!.speedAlertSound ?? true,
      },
    })
  } catch (error) {
    console.error('Speed settings PUT error:', error)
    return NextResponse.json({ error: 'Napaka strežnika' }, { status: 500 })
  }
}
