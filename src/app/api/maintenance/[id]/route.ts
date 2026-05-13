import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { completed, nextMileage, nextDate } = body

    const updateData: Record<string, unknown> = {}
    if (completed !== undefined) {
      updateData.completed = completed
      if (completed) updateData.completedAt = new Date()
    }
    if (nextMileage !== undefined) updateData.nextMileage = parseInt(nextMileage)
    if (nextDate !== undefined) updateData.nextDate = new Date(nextDate)

    const reminder = await db.maintenanceReminder.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: reminder })
  } catch (error) {
    console.error('Maintenance PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju opomnika' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.maintenanceReminder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Maintenance DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju opomnika' }, { status: 500 })
  }
}
