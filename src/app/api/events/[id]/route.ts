import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const event = await db.motoEvent.findUnique({ where: { id } })
    if (!event) return NextResponse.json({ error: 'Dogodek ni najden' }, { status: 404 })
    return NextResponse.json({ data: event })
  } catch (error) {
    console.error('Event fetch error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.motoEvent.delete({ where: { id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Event delete error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju' }, { status: 500 })
  }
}
