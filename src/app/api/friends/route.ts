import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/friends?userId=xxx&status=all|accepted|pending
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const statusFilter = searchParams.get('status') || 'all'

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    // Fetch friendships where user is either requester or addressee
    const where: Record<string, unknown> = {
      OR: [
        { requesterId: userId },
        { addresseeId: userId },
      ],
    }

    if (statusFilter !== 'all') {
      where.status = statusFilter
    }

    const friendships = await db.friendship.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
        addressee: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Merge into clean list: for each friendship, determine the "friend" (the other user)
    const data = friendships.map((f) => {
      const isRequester = f.requesterId === userId
      const friend = isRequester ? f.addressee : f.requester
      return {
        id: f.id,
        status: f.status,
        requesterId: f.requesterId,
        addresseeId: f.addresseeId,
        friend,
        createdAt: f.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Fetch friends error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch friends' }, { status: 500 })
  }
}

// POST /api/friends - Send friend request
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { requesterId, addresseeId } = body

    if (!requesterId || !addresseeId) {
      return NextResponse.json({ success: false, error: 'requesterId and addresseeId are required' }, { status: 400 })
    }

    if (requesterId === addresseeId) {
      return NextResponse.json({ success: false, error: 'Cannot add yourself as friend' }, { status: 400 })
    }

    // Check if friendship already exists (in either direction)
    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    })

    if (existing) {
      return NextResponse.json({ success: false, error: 'Friendship already exists' }, { status: 400 })
    }

    // Verify both users exist
    const [requester, addressee] = await Promise.all([
      db.user.findUnique({ where: { id: requesterId } }),
      db.user.findUnique({ where: { id: addresseeId } }),
    ])

    if (!requester || !addressee) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const friendship = await db.friendship.create({
      data: { requesterId, addresseeId, status: 'pending' },
      include: {
        requester: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
        addressee: { select: { id: true, name: true, email: true, avatar: true, bike: true } },
      },
    })

    // Create notification for addressee
    await db.notification.create({
      data: {
        type: 'friend_request',
        title: 'Nova prošnja za prijateljstvo',
        message: `${requester.name} vas želi dodati med prijatelje`,
        userId: addresseeId,
        fromUserId: requesterId,
        relatedId: friendship.id,
      },
    })

    const data = {
      id: friendship.id,
      status: friendship.status,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      friend: friendship.addressee,
      createdAt: friendship.createdAt.toISOString(),
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('Create friendship error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create friendship' }, { status: 500 })
  }
}
