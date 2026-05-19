import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/subscription?userId=xxx
// Returns mock subscription data (subscription model not in DB yet)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Return free plan default (subscription model not yet in DB)
    return NextResponse.json({
      data: {
        id: '',
        userId,
        plan: 'free',
        status: 'active',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      }
    })
  } catch (error: unknown) {
    console.error('Subscription API error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Napaka pri pridobivanju naročnine' }, { status: 500 })
  }
}

// POST /api/subscription — Create/update subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan } = body

    if (!userId || !plan) {
      return NextResponse.json({ error: 'userId and plan are required' }, { status: 400 })
    }

    // Mock response (subscription model not yet in DB)
    return NextResponse.json({
      data: {
        id: 'mock-sub-' + Date.now(),
        userId,
        plan,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      }
    })
  } catch (error: unknown) {
    console.error('Subscription API error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročnine' }, { status: 500 })
  }
}

// PUT /api/subscription — Cancel subscription
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Mock response (subscription model not yet in DB)
    return NextResponse.json({
      data: {
        id: 'mock-sub',
        userId,
        plan: 'free',
        status: 'cancelled',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      }
    })
  } catch (error: unknown) {
    console.error('Subscription API error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Napaka pri preklicu naročnine' }, { status: 500 })
  }
}
