import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'Strošek ni najden' }, { status: 404 })
    }
    await db.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Expense DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju' }, { status: 500 })
  }
}
