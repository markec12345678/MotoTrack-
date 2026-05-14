import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/camps/[id] - Get single camp site by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const camp = await db.campSite.findUnique({
      where: { id },
    })

    if (!camp) {
      return NextResponse.json(
        { success: false, error: 'Camp site not found' },
        { status: 404 }
      )
    }

    // Parse amenities JSON if present
    const parsedCamp = {
      ...camp,
      amenities: camp.amenities ? JSON.parse(camp.amenities) : null,
    }

    return NextResponse.json({
      success: true,
      data: parsedCamp,
    })
  } catch (error) {
    console.error('Fetch camp error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch camp site' },
      { status: 500 }
    )
  }
}
