import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!userId) {
      return NextResponse.json({ error: 'userId je obvezen' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (type) where.type = type

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    })

    // Calculate totals
    const allExpenses = await db.expense.findMany({ where: { userId } })
    const totalAll = allExpenses.reduce((sum, e) => sum + e.amount, 0)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthExpenses = allExpenses.filter(e => new Date(e.date) >= monthStart)
    const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Group by type
    const byType: Record<string, number> = {}
    allExpenses.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + e.amount
    })

    return NextResponse.json({
      success: true,
      data: expenses,
      totals: { all: Math.round(totalAll * 100) / 100, month: Math.round(totalMonth * 100) / 100 },
      byType,
    })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju stroškov' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, type, amount, description, mileage, date } = body

    if (!userId || !type || amount === undefined) {
      return NextResponse.json({ error: 'userId, type in amount so obvezni' }, { status: 400 })
    }

    const expense = await db.expense.create({
      data: {
        userId,
        type,
        amount: parseFloat(amount),
        description: description || null,
        mileage: mileage ? parseInt(mileage) : null,
        date: date ? new Date(date) : new Date(),
      },
    })

    // Update user mileage if provided
    if (mileage) {
      await db.user.update({
        where: { id: userId },
        data: { currentMileage: parseInt(mileage) },
      })
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju stroška' }, { status: 500 })
  }
}
