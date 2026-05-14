import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/route-roi/compare?routeIds=id1,id2&userId=xxx
// Compare ROI of multiple routes side by side
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeIdsParam = searchParams.get('routeIds')
    const userId = searchParams.get('userId')

    if (!routeIdsParam) {
      return NextResponse.json(
        { success: false, error: 'routeIds parameter is required (comma-separated)' },
        { status: 400 }
      )
    }

    const routeIds = routeIdsParam.split(',').map(id => id.trim()).filter(Boolean)
    if (routeIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 route IDs required for comparison' },
        { status: 400 }
      )
    }

    if (routeIds.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 routes can be compared at once' },
        { status: 400 }
      )
    }

    const comparisons = []

    for (const routeId of routeIds) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) continue

      // Try to find existing ROI score
      const where: Record<string, string> = { routeId }
      if (userId) where.userId = userId

      const existing = await db.routeRoiScore.findFirst({ where })

      if (existing) {
        comparisons.push({
          routeId: existing.routeId,
          routeTitle: route.title,
          routeCategory: route.category,
          routeDistance: route.distance,
          routeDifficulty: route.difficulty,
          sceneryScore: existing.sceneryScore,
          twistinessScore: existing.twistinessScore,
          roadQualityScore: existing.roadQualityScore,
          weatherScore: existing.weatherScore,
          fuelEfficiencyScore: existing.fuelEfficiencyScore,
          timeEfficiencyScore: existing.timeEfficiencyScore,
          overallRoi: existing.overallRoi,
          timePerKm: existing.timePerKm ?? 0,
          fuelCost: existing.fuelCost ?? 0,
          pointsOfInterest: existing.pointsOfInterest,
          recommendedWeather: existing.recommendedWeather ?? '',
          bestSeason: existing.bestSeason ?? '',
        })
      } else {
        // Calculate on-the-fly (simplified)
        const category = route.category || 'scenic'
        const distance = route.distance || 50
        const sceneryScore = category === 'scenic' ? 8 : category === 'adventure' ? 7 : 5
        const twistinessScore = category === 'twisty' ? 9 : category === 'enduro' ? 7 : 5
        const roadQualityScore = category === 'offroad' || category === 'enduro' ? 4 : 7
        const weatherScore = category === 'racetrack' ? 9 : category === 'twisty' ? 8 : 6
        const fuelEfficiencyScore = distance < 60 ? 8 : distance < 100 ? 6 : 4
        const timeEfficiencyScore = category === 'racetrack' ? 9 : category === 'city' ? 5 : 7
        const overallRoi = Math.round(
          sceneryScore * 0.25 +
          twistinessScore * 0.2 +
          roadQualityScore * 0.2 +
          weatherScore * 0.15 +
          fuelEfficiencyScore * 0.1 +
          timeEfficiencyScore * 0.1
        ) * 10

        comparisons.push({
          routeId: route.id,
          routeTitle: route.title,
          routeCategory: category,
          routeDistance: distance,
          routeDifficulty: route.difficulty,
          sceneryScore,
          twistinessScore,
          roadQualityScore,
          weatherScore,
          fuelEfficiencyScore,
          timeEfficiencyScore,
          overallRoi: Math.min(100, overallRoi),
          timePerKm: category === 'offroad' ? 2.0 : category === 'scenic' ? 1.2 : 1.5,
          fuelCost: Math.round((distance / 100) * 5.5 * 1.55 * 100) / 100,
          pointsOfInterest: 0,
          recommendedWeather: category === 'offroad' ? 'dry' : 'clear',
          bestSeason: 'spring_autumn',
        })
      }
    }

    if (comparisons.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Not enough valid routes found for comparison' },
        { status: 404 }
      )
    }

    // Find the winner for each metric
    const metrics = [
      'sceneryScore', 'twistinessScore', 'roadQualityScore',
      'weatherScore', 'fuelEfficiencyScore', 'timeEfficiencyScore',
      'overallRoi',
    ] as const

    type MetricKey = typeof metrics[number]
    const winners: Record<string, string | null> = {}
    for (const metric of metrics) {
      let bestId: string | null = null
      let bestVal = -1
      for (const c of comparisons) {
        const val = c[metric as MetricKey] as number
        if (val > bestVal) {
          bestVal = val
          bestId = c.routeId
        }
      }
      winners[metric] = bestId
    }

    // Find lowest fuel cost (winner)
    let cheapestId: string | null = null
    let cheapestCost = Infinity
    for (const c of comparisons) {
      if (c.fuelCost < cheapestCost) {
        cheapestCost = c.fuelCost
        cheapestId = c.routeId
      }
    }
    winners['fuelCost'] = cheapestId

    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        winners,
        bestOverall: comparisons.reduce((a, b) => a.overallRoi > b.overallRoi ? a : b).routeId,
      },
    })
  } catch (error) {
    console.error('Route ROI compare error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to compare routes' },
      { status: 500 }
    )
  }
}
