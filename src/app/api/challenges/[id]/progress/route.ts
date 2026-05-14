import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId, progress } = await req.json()
    if (!userId || progress === undefined) return NextResponse.json({ error: 'userId and progress required' }, { status: 400 })

    const challenge = await db.challenge.findUnique({ where: { id } })
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    const completed = progress >= challenge.goal
    const pointsEarned = completed ? challenge.points : 0

    const participant = await db.challengeParticipant.update({
      where: { challengeId_userId: { challengeId: id, userId } },
      data: { progress, completed, completedAt: completed ? new Date() : undefined, pointsEarned }
    })

    if (completed && pointsEarned > 0) {
      // Award points
      const upsert = await db.userPoints.upsert({
        where: { userId },
        update: { totalPoints: { increment: pointsEarned }, challengePoints: { increment: pointsEarned } },
        create: { userId, totalPoints: pointsEarned, challengePoints: pointsEarned }
      })
      await db.pointsTransaction.create({ data: { userId, amount: pointsEarned, reason: 'challenge_won', relatedId: id } })
      // Update level
      const newLevel = Math.floor(upsert.totalPoints / 500) + 1
      await db.userPoints.update({ where: { userId }, data: { level: newLevel } })
    }

    return NextResponse.json({ data: participant })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
