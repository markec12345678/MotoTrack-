import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    const challenges = await db.challenge.findMany({
      where: { isPublic: true, endDate: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { participants: true } }, participants: userId ? { where: { userId }, select: { progress: true, completed: true, pointsEarned: true } } : false }
    })

    const now = new Date()
    const data = challenges.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      goal: c.goal,
      unit: c.unit,
      startDate: c.startDate,
      endDate: c.endDate,
      isPublic: c.isPublic,
      category: c.category,
      icon: c.icon,
      points: c.points,
      participantCount: c._count.participants,
      userProgress: c.participants?.[0]?.progress || 0,
      userCompleted: c.participants?.[0]?.completed || false,
      daysRemaining: Math.max(0, Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
    }))

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, type, goal, unit, startDate, endDate, category, icon, points, creatorId } = await req.json()
    if (!title || !type || !goal || !unit || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const challenge = await db.challenge.create({
      data: { title, description, type, goal, unit, startDate: new Date(startDate), endDate: new Date(endDate), category: category || 'monthly', icon: icon || '🏆', points: points || 100, creatorId }
    })

    return NextResponse.json({ data: challenge })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
