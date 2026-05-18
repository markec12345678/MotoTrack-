import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { completed, nextMileage, nextDate, lastServiceKm, lastServiceDate, notes, currentMileage } = body

    // If marking as done (completed: true), auto-reset next service based on intervals
    if (completed === true) {
      const existing = await db.maintenanceReminder.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'Opomnik ni najden' }, { status: 404 })
      }

      const now = new Date()
      const serviceKm = currentMileage ?? existing.lastServiceKm ?? 0

      const updateData: Record<string, unknown> = {
        completed: false, // Reset to active instead of marking complete
        completedAt: now,
        lastServiceKm: serviceKm,
        lastServiceDate: now,
      }

      // Auto-calculate next service based on intervals
      if (existing.intervalKm && serviceKm) {
        updateData.nextMileage = serviceKm + existing.intervalKm
      }
      if (existing.intervalDays) {
        const nextDt = new Date(now.getTime() + existing.intervalDays * 24 * 60 * 60 * 1000)
        updateData.nextDate = nextDt
      }

      const reminder = await db.maintenanceReminder.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ success: true, data: reminder })
    }

    // Normal update
    const updateData: Record<string, unknown> = {}
    if (nextMileage !== undefined) updateData.nextMileage = parseInt(String(nextMileage))
    if (nextDate !== undefined) updateData.nextDate = new Date(nextDate)
    if (lastServiceKm !== undefined) updateData.lastServiceKm = parseInt(String(lastServiceKm))
    if (lastServiceDate !== undefined) updateData.lastServiceDate = new Date(lastServiceDate)
    if (notes !== undefined) updateData.notes = notes
    if (completed !== undefined) {
      updateData.completed = completed
      if (completed) updateData.completedAt = new Date()
    }

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
