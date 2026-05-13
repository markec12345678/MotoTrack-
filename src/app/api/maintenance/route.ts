import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const completed = searchParams.get('completed')

    if (!userId) {
      return NextResponse.json({ error: 'userId je obvezen' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (completed !== null && completed !== undefined) {
      where.completed = completed === 'true'
    }

    const reminders = await db.maintenanceReminder.findMany({
      where,
      orderBy: { nextMileage: 'asc' },
    })

    return NextResponse.json({ success: true, data: reminders })
  } catch (error) {
    console.error('Maintenance GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju opomnikov' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, type, title, nextMileage, nextDate, intervalKm, intervalDays } = body

    if (!userId || !type || !title) {
      return NextResponse.json({ error: 'userId, type in title so obvezni' }, { status: 400 })
    }

    const reminder = await db.maintenanceReminder.create({
      data: {
        userId,
        type,
        title,
        nextMileage: nextMileage ? parseInt(nextMileage) : null,
        nextDate: nextDate ? new Date(nextDate) : null,
        intervalKm: intervalKm ? parseInt(intervalKm) : null,
        intervalDays: intervalDays ? parseInt(intervalDays) : null,
      },
    })

    return NextResponse.json({ success: true, data: reminder })
  } catch (error) {
    console.error('Maintenance POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju opomnika' }, { status: 500 })
  }
}
