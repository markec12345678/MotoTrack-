import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/sync-queue?userId=xxx&status=pending
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const statusFilter = searchParams.get('status')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (statusFilter) where.status = statusFilter

    const items = await db.offlineSyncQueue.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    const data = items.map(item => ({
      id: item.id,
      userId: item.userId,
      operation: item.operation,
      entity: item.entity,
      entityId: item.entityId,
      data: item.data ? JSON.parse(item.data) : {},
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      lastAttemptAt: item.lastAttemptAt?.toISOString() || null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Sync queue GET error:', error)
    return NextResponse.json({ error: 'Failed to get sync queue' }, { status: 500 })
  }
}

// POST /api/sync-queue — Add item to queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, operation, entity, entityId, data } = body

    if (!userId || !operation || !entity) {
      return NextResponse.json({ error: 'userId, operation, and entity are required' }, { status: 400 })
    }

    const item = await db.offlineSyncQueue.create({
      data: {
        userId,
        operation,
        entity,
        entityId: entityId || null,
        data: data ? JSON.stringify(data) : '{}',
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
      },
    })

    return NextResponse.json({
      data: {
        id: item.id,
        userId: item.userId,
        operation: item.operation,
        entity: item.entity,
        entityId: item.entityId,
        data: item.data ? JSON.parse(item.data) : {},
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Sync queue POST error:', error)
    return NextResponse.json({ error: 'Failed to add to sync queue' }, { status: 500 })
  }
}

// PUT /api/sync-queue — Update item status (or sync all)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { queueId, status, syncAll, userId } = body

    // Sync all pending items
    if (syncAll && userId) {
      const pending = await db.offlineSyncQueue.findMany({
        where: { userId, status: 'pending' },
      })

      let completed = 0
      let failed = 0

      for (const item of pending) {
        try {
          // Simulate processing: mark as completed
          await db.offlineSyncQueue.update({
            where: { id: item.id },
            data: {
              status: 'completed',
              attempts: item.attempts + 1,
              lastAttemptAt: new Date(),
            },
          })
          completed++
        } catch {
          // Mark as failed
          const newAttempts = item.attempts + 1
          await db.offlineSyncQueue.update({
            where: { id: item.id },
            data: {
              status: newAttempts >= item.maxAttempts ? 'failed' : 'pending',
              attempts: newAttempts,
              lastAttemptAt: new Date(),
            },
          })
          failed++
        }
      }

      return NextResponse.json({
        data: { completed, failed, total: pending.length },
      })
    }

    // Single item update
    if (!queueId || !status) {
      return NextResponse.json({ error: 'queueId and status are required' }, { status: 400 })
    }

    const item = await db.offlineSyncQueue.update({
      where: { id: queueId },
      data: {
        status,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    })

    return NextResponse.json({
      data: {
        id: item.id,
        userId: item.userId,
        operation: item.operation,
        entity: item.entity,
        status: item.status,
        attempts: item.attempts,
      },
    })
  } catch (error) {
    console.error('Sync queue PUT error:', error)
    return NextResponse.json({ error: 'Failed to update sync queue' }, { status: 500 })
  }
}

// DELETE /api/sync-queue?userId=xxx&completed=true
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const completed = searchParams.get('completed') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (completed) {
      await db.offlineSyncQueue.deleteMany({
        where: { userId, status: 'completed' },
      })
    } else {
      await db.offlineSyncQueue.deleteMany({
        where: { userId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sync queue DELETE error:', error)
    return NextResponse.json({ error: 'Failed to clear sync queue' }, { status: 500 })
  }
}
