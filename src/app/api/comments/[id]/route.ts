import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/comments/[id] - Delete a comment by id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const comment = await db.comment.findUnique({ where: { id } })

    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    await db.comment.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
