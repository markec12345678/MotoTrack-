import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const members = await db.communityMember.findMany({
      where: { communityId: id },
      include: { user: { select: { id: true, name: true, avatar: true, bike: true } } },
      orderBy: { joinedAt: 'desc' },
    })

    const data = members.map(m => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Members fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju članov' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    // Check if already a member
    const existing = await db.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId: id } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ste že član' }, { status: 400 })
    }

    const member = await db.communityMember.create({
      data: { userId, communityId: id, role: 'member' },
      include: { user: { select: { id: true, name: true, avatar: true, bike: true } } },
    })

    return NextResponse.json({ data: member })
  } catch (error) {
    console.error('Join community error:', error)
    return NextResponse.json({ error: 'Napaka pri vstopu v skupnost' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    await db.communityMember.deleteMany({
      where: { userId, communityId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Leave community error:', error)
    return NextResponse.json({ error: 'Napaka pri izstopu iz skupnosti' }, { status: 500 })
  }
}
