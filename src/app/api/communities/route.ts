import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const communities = await db.community.findMany({
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true, bike: true } } } },
        _count: { select: { members: true, rides: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const data = communities.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      avatar: c.avatar,
      isPublic: c.isPublic,
      createdAt: c.createdAt.toISOString(),
      memberCount: c._count.members,
      rideCount: c._count.rides,
      isMember: userId ? c.members.some(m => m.userId === userId) : false,
      userRole: userId ? c.members.find(m => m.userId === userId)?.role || null : null,
      recentMembers: c.members.slice(-3).map(m => m.user),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Communities fetch error:', error)
    return NextResponse.json({ success: false, error: 'Napaka pri pridobivanju skupnosti' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, avatar, isPublic, userId } = body

    if (!name || !userId) {
      return NextResponse.json({ success: false, error: 'Manjka ime ali userId' }, { status: 400 })
    }

    const community = await db.community.create({
      data: {
        name,
        description: description || null,
        avatar: avatar || '🏍️',
        isPublic: isPublic !== false,
        members: {
          create: { userId, role: 'admin' },
        },
      },
      include: { members: true },
    })

    return NextResponse.json({ success: true, data: community })
  } catch (error) {
    console.error('Community create error:', error)
    return NextResponse.json({ success: false, error: 'Napaka pri ustvarjanju skupnosti' }, { status: 500 })
  }
}
