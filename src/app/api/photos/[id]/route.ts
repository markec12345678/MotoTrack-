import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/photos/[id] - Delete a photo (only owner can delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const photo = await db.photo.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!photo) {
      return NextResponse.json(
        { success: false, error: 'Foto ni najdeno' },
        { status: 404 }
      )
    }

    // Check ownership via query param
    const { searchParams } = new URL(_request.url)
    const userId = searchParams.get('userId')

    if (!userId || photo.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Nimate dovoljenja za brisanje te fotografije' },
        { status: 403 }
      )
    }

    await db.photo.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      data: { id },
    })
  } catch (error) {
    console.error('Delete photo error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}
