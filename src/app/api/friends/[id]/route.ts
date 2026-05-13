import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/friends/[id] - Accept or reject friend request
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, userId } = body

    if (!status || !userId) {
      return NextResponse.json({ success: false, error: 'status and userId are required' }, { status: 400 })
    }

    if (!['accepted', 'rejected', 'blocked'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const friendship = await db.friendship.findUnique({ where: { id } })

    if (!friendship) {
      return NextResponse.json({ success: false, error: 'Friendship not found' }, { status: 404 })
    }

    // Only the addressee can accept/reject
    if (friendship.addresseeId !== userId) {
      return NextResponse.json({ success: false, error: 'Only the addressee can accept or reject' }, { status: 403 })
    }

    const updated = await db.friendship.update({
      where: { id },
      data: { status },
      include: {
        requester: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
        addressee: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
      },
    })

    // If accepted, notify the requester
    if (status === 'accepted') {
      await db.notification.create({
        data: {
          type: 'friend_request',
          title: 'Prošnja za prijateljstvo sprejeta',
          message: `${updated.addressee.name} je sprejel/a vašo prošnjo za prijateljstvo`,
          userId: updated.requesterId,
          fromUserId: updated.addresseeId,
          relatedId: updated.id,
        },
      })
    }

    const data = {
      id: updated.id,
      status: updated.status,
      requesterId: updated.requesterId,
      addresseeId: updated.addresseeId,
      friend: updated.requester,
      createdAt: updated.createdAt.toISOString(),
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Update friendship error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update friendship' }, { status: 500 })
  }
}

// DELETE /api/friends/[id] - Remove friendship
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const friendship = await db.friendship.findUnique({ where: { id } })

    if (!friendship) {
      return NextResponse.json({ success: false, error: 'Friendship not found' }, { status: 404 })
    }

    // Only participants can delete
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 })
    }

    await db.friendship.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete friendship error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete friendship' }, { status: 500 })
  }
}
