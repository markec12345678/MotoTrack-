import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const mode = searchParams.get('mode') // 'leaderboard' or 'user'

    if (mode === 'leaderboard') {
      const top = await db.userPoints.findMany({
        orderBy: { totalPoints: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, avatar: true, bike: true } } }
      })
      return NextResponse.json({ data: top })
    }

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    let points = await db.userPoints.findUnique({ where: { userId } })
    if (!points) {
      points = await db.userPoints.create({ data: { userId } })
    }

    const transactions = await db.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      data: {
        totalPoints: points.totalPoints,
        level: points.level,
        ridesPoints: points.ridesPoints,
        socialPoints: points.socialPoints,
        challengePoints: points.challengePoints,
        streakDays: points.streakDays,
        recentTransactions: transactions,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, reason, relatedId } = await req.json()
    if (!userId || !amount || !reason) return NextResponse.json({ error: 'userId, amount, reason required' }, { status: 400 })

    const tx = await db.pointsTransaction.create({ data: { userId, amount, reason, relatedId } })

    // Update user points
    const points = await db.userPoints.upsert({
      where: { userId },
      update: {
        totalPoints: { increment: amount },
        ridesPoints: reason.startsWith('ride') ? { increment: amount } : undefined,
        socialPoints: reason.startsWith('social') ? { increment: amount } : undefined,
        challengePoints: reason.startsWith('challenge') ? { increment: amount } : undefined,
      },
      create: { userId, totalPoints: amount, ridesPoints: reason.startsWith('ride') ? amount : 0, socialPoints: reason.startsWith('social') ? amount : 0, challengePoints: reason.startsWith('challenge') ? amount : 0 }
    })

    // Update level
    const newLevel = Math.floor(points.totalPoints / 500) + 1
    await db.userPoints.update({ where: { userId }, data: { level: newLevel } })

    return NextResponse.json({ data: { transaction: tx, totalPoints: points.totalPoints + amount, level: newLevel } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
