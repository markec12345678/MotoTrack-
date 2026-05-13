import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { userId, rideId, maxLeanLeft, maxLeanRight, avgLean, dataPoints, duration } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const session = await db.leanAngleSession.create({
      data: { userId, rideId, maxLeanLeft: maxLeanLeft || 0, maxLeanRight: maxLeanRight || 0, avgLean: avgLean || 0, dataPoints: dataPoints || '[]', duration: duration || 0 }
    })

    return NextResponse.json({ data: session })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const limit = parseInt(searchParams.get('limit') || '20')

    const sessions = await db.leanAngleSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ data: sessions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
