import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const camp = await db.campSite.findUnique({ where: { id } })
    if (!camp) return NextResponse.json({ error: 'Kamp ni najden' }, { status: 404 })
    return NextResponse.json({ data: { ...camp, amenities: camp.amenities ? JSON.parse(camp.amenities) : [] } })
  } catch (error) {
    console.error('Camp fetch error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
