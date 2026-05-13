import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const groupRide = await db.groupRide.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatar: true, bike: true } },
        participants: {
          include: { user: { select: { id: true, name: true, avatar: true, bike: true } } },
        },
      },
    })
    if (!groupRide) return NextResponse.json({ error: 'Ni najdeno' }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        ...groupRide,
        date: groupRide.date.toISOString(),
        createdAt: groupRide.createdAt.toISOString(),
        participantCount: groupRide.participants.length,
        participants: groupRide.participants.map(p => ({
          id: p.id, userId: p.userId, status: p.status,
          joinedAt: p.joinedAt.toISOString(), user: p.user,
        })),
      },
    })
  } catch (error) {
    console.error('GroupRide GET error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.title) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description

    const groupRide = await db.groupRide.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: groupRide })
  } catch (error) {
    console.error('GroupRide PUT error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.groupRide.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GroupRide DELETE error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
