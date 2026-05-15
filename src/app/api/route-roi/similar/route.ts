import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/route-roi/similar?routeId=xxx&limit=3
// Get similar routes with their ROI scores based on same category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 5)

    if (!routeId) {
      return NextResponse.json(
        { success: false, error: 'routeId is required' },
        { status: 400 }
      )
    }

    const sourceRoute = await db.route.findUnique({ where: { id: routeId } })
    if (!sourceRoute) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 }
      )
    }

    const category = sourceRoute.category || 'scenic'

    // Find routes with the same category, excluding the source route
    const similarRoutes = await db.route.findMany({
      where: {
        category,
        isPublic: true,
        id: { not: routeId },
      },
      include: {
        routeRoiScores: { take: 1, orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: { likes: 'desc' },
    })

    const data = similarRoutes.map(r => {
      const roi = r.routeRoiScores[0]
      return {
        routeId: r.id,
        title: r.title,
        category: r.category,
        difficulty: r.difficulty,
        distance: r.distance,
        likes: r.likes,
        overallRoi: roi?.overallRoi ?? null,
        fuelCost: roi?.fuelCost ?? null,
        bestSeason: roi?.bestSeason ?? null,
        userName: r.user?.name,
      }
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Similar routes error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch similar routes' },
      { status: 500 }
    )
  }
}
