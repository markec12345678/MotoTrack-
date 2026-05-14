import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      // Return default values if no userId
      const fuelCapacity = 15.0
      const fuelConsumption = 5.5
      const currentFuel = 15.0
      const range = (currentFuel / fuelConsumption) * 100
      return NextResponse.json({
        data: {
          fuelCapacity,
          fuelConsumption,
          currentFuel,
          range: Math.round(range * 10) / 10,
          lastRefuelAt: null,
        },
      })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        fuelCapacity: true,
        fuelConsumption: true,
        currentFuel: true,
        lastRefuelAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const fuelCapacity = user.fuelCapacity ?? 15.0
    const fuelConsumption = user.fuelConsumption ?? 5.5
    const currentFuel = user.currentFuel ?? 15.0
    const range = fuelConsumption > 0 ? (currentFuel / fuelConsumption) * 100 : 0

    return NextResponse.json({
      data: {
        fuelCapacity,
        fuelConsumption,
        currentFuel,
        range: Math.round(range * 10) / 10,
        lastRefuelAt: user.lastRefuelAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('Fuel GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, fuelCapacity, fuelConsumption, currentFuel } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof fuelCapacity === 'number' && fuelCapacity > 0) {
      updateData.fuelCapacity = fuelCapacity
    }
    if (typeof fuelConsumption === 'number' && fuelConsumption > 0) {
      updateData.fuelConsumption = fuelConsumption
    }
    if (typeof currentFuel === 'number' && currentFuel >= 0) {
      updateData.currentFuel = currentFuel
      // Set lastRefuelAt when filling tank (currentFuel equals or exceeds capacity)
      const capacity = (updateData.fuelCapacity as number) ?? user.fuelCapacity ?? 15.0
      if (currentFuel >= capacity) {
        updateData.lastRefuelAt = new Date()
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.user.update({
        where: { id: userId },
        data: updateData,
      })
    }

    // Return updated fuel data
    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        fuelCapacity: true,
        fuelConsumption: true,
        currentFuel: true,
        lastRefuelAt: true,
      },
    })

    const fc = updatedUser!.fuelCapacity ?? 15.0
    const fcs = updatedUser!.fuelConsumption ?? 5.5
    const cf = updatedUser!.currentFuel ?? 15.0
    const range = fcs > 0 ? (cf / fcs) * 100 : 0

    return NextResponse.json({
      data: {
        fuelCapacity: fc,
        fuelConsumption: fcs,
        currentFuel: cf,
        range: Math.round(range * 10) / 10,
        lastRefuelAt: updatedUser!.lastRefuelAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('Fuel POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
