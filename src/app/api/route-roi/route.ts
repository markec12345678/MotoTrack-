import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Average distance per route category (km) — used for fuelEfficiencyScore
const AVG_DISTANCE_BY_CATEGORY: Record<string, number> = {
  scenic: 80,
  twisty: 60,
  offroad: 50,
  city: 30,
  snowmobile: 40,
  racetrack: 20,
  enduro: 45,
  adventure: 120,
}

// Recommended weather by route category
const WEATHER_BY_CATEGORY: Record<string, string> = {
  offroad: 'dry',
  twisty: 'clear',
  scenic: 'partly_cloudy',
  city: 'any',
  snowmobile: 'snow',
  racetrack: 'clear',
  enduro: 'dry',
  adventure: 'partly_cloudy',
}

// Best season by approximate latitude/elevation
function deriveBestSeason(lat: number, _elevation: number): string {
  // Alpine / high latitude => summer is best
  if (lat > 46 || _elevation > 1000) return 'summer'
  // Mediterranean / low latitude => spring/autumn
  if (lat < 43) return 'spring_autumn'
  // Central Balkan
  return 'spring_autumn'
}

// Calculate fuel efficiency score (1-10): shorter routes for the category = higher score
function calcFuelEfficiencyScore(distance: number, category: string): number {
  const avg = AVG_DISTANCE_BY_CATEGORY[category] || 70
  // If distance <= avg, score is high; if much larger, score drops
  const ratio = avg / Math.max(distance, 1)
  return Math.min(10, Math.max(1, Math.round(ratio * 7)))
}

// Calculate time efficiency score (1-10): lower minutes/km is better
function calcTimeEfficiencyScore(timePerKm: number): number {
  // Motorcycle avg: ~1.2 min/km on scenic, ~0.8 min/km on highway
  // Lower is better: 0.5 min/km => 10, 3+ min/km => 1
  if (timePerKm <= 0.5) return 10
  if (timePerKm >= 3) return 1
  return Math.round(10 - ((timePerKm - 0.5) / 2.5) * 9)
}

// Derive weather score from route category (heuristic default)
function deriveWeatherScore(category: string): number {
  const map: Record<string, number> = {
    scenic: 7,
    twisty: 8,
    offroad: 6,
    city: 5,
    snowmobile: 4,
    racetrack: 9,
    enduro: 6,
    adventure: 7,
  }
  return map[category] || 6
}

// Calculate overall ROI score
function calcOverallRoi(
  sceneryScore: number,
  twistinessScore: number,
  roadQualityScore: number,
  weatherScore: number,
  fuelEfficiencyScore: number,
  timeEfficiencyScore: number,
): number {
  const raw =
    sceneryScore * 0.25 +
    twistinessScore * 0.2 +
    roadQualityScore * 0.2 +
    weatherScore * 0.15 +
    fuelEfficiencyScore * 0.1 +
    timeEfficiencyScore * 0.1
  return Math.min(100, Math.max(0, Math.round(raw * 10)))
}

// Estimate fuel cost in EUR
function calcFuelCost(distanceKm: number): number {
  // Assume 5.5 L/100km and 1.55 EUR/L (Slovenian avg)
  const consumptionPer100km = 5.5
  const pricePerLiter = 1.55
  return Math.round((distanceKm / 100) * consumptionPer100km * pricePerLiter * 100) / 100
}

// Estimate time per km (minutes) — based on category difficulty
function estimateTimePerKm(category: string, difficulty: string): number {
  const baseByCategory: Record<string, number> = {
    scenic: 1.2,
    twisty: 1.5,
    offroad: 2.0,
    city: 1.8,
    snowmobile: 1.3,
    racetrack: 0.8,
    enduro: 2.2,
    adventure: 1.6,
  }
  const diffMultiplier: Record<string, number> = {
    easy: 0.85,
    medium: 1.0,
    hard: 1.3,
  }
  const base = baseByCategory[category] || 1.5
  const mult = diffMultiplier[difficulty] || 1.0
  return Math.round(base * mult * 100) / 100
}

// GET /api/route-roi?routeId=...&userId=...&history=true
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')
    const userId = searchParams.get('userId')
    const history = searchParams.get('history')

    if (!routeId) {
      return NextResponse.json(
        { success: false, error: 'routeId is required' },
        { status: 400 },
      )
    }

    // History mode: return all ROI scores for the route (latest 3)
    if (history === 'true') {
      const scores = await db.routeRoiScore.findMany({
        where: { routeId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      })
      return NextResponse.json({
        success: true,
        data: scores.map(s => ({
          id: s.id,
          routeId: s.routeId,
          userId: s.userId,
          sceneryScore: s.sceneryScore,
          twistinessScore: s.twistinessScore,
          roadQualityScore: s.roadQualityScore,
          weatherScore: s.weatherScore,
          fuelEfficiencyScore: s.fuelEfficiencyScore,
          timeEfficiencyScore: s.timeEfficiencyScore,
          overallRoi: s.overallRoi,
          timePerKm: s.timePerKm ?? 0,
          fuelCost: s.fuelCost ?? 0,
          pointsOfInterest: s.pointsOfInterest,
          recommendedWeather: s.recommendedWeather ?? '',
          bestSeason: s.bestSeason ?? '',
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
      })
    }

    // Try to find existing ROI score
    const where: Record<string, string> = { routeId }
    if (userId) where.userId = userId

    const existing = await db.routeRoiScore.findFirst({ where })

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          id: existing.id,
          routeId: existing.routeId,
          userId: existing.userId,
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
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
        },
      })
    }

    // Calculate on-the-fly from route data
    const route = await db.route.findUnique({
      where: { id: routeId },
    })

    if (!route) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 },
      )
    }

    // Derive scores from route metadata
    const category = route.category || 'scenic'
    const difficulty = route.difficulty || 'medium'
    const distance = route.distance || 50

    // Parse waypoints to get approximate lat
    let startLat = 46.0 // default Slovenia
    try {
      const wps = typeof route.waypoints === 'string' ? JSON.parse(route.waypoints) : route.waypoints
      if (Array.isArray(wps) && wps.length > 0 && wps[0].lat) {
        startLat = wps[0].lat
      }
    } catch { /* use default */ }

    // Derive heuristic scores based on category/difficulty
    const sceneryScore = category === 'scenic' ? 8 : category === 'adventure' ? 7 : category === 'twisty' ? 6 : 5
    const twistinessScore = category === 'twisty' ? 9 : category === 'enduro' ? 7 : category === 'scenic' ? 5 : 4
    const roadQualityScore = category === 'offroad' || category === 'enduro' ? 4 : difficulty === 'hard' ? 5 : difficulty === 'easy' ? 9 : 7
    const weatherScore = deriveWeatherScore(category)
    const timePerKm = estimateTimePerKm(category, difficulty)
    const fuelEfficiencyScore = calcFuelEfficiencyScore(distance, category)
    const timeEfficiencyScore = calcTimeEfficiencyScore(timePerKm)

    const overallRoi = calcOverallRoi(
      sceneryScore, twistinessScore, roadQualityScore,
      weatherScore, fuelEfficiencyScore, timeEfficiencyScore,
    )

    const fuelCost = calcFuelCost(distance)
    const recommendedWeather = WEATHER_BY_CATEGORY[category] || 'clear'
    const bestSeason = deriveBestSeason(startLat, 0)

    // Count POIs near the route
    const poiCount = await db.poi.count()

    return NextResponse.json({
      success: true,
      data: {
        id: '',
        routeId,
        userId: userId || '',
        sceneryScore,
        twistinessScore,
        roadQualityScore,
        weatherScore,
        fuelEfficiencyScore,
        timeEfficiencyScore,
        overallRoi,
        timePerKm,
        fuelCost,
        pointsOfInterest: poiCount,
        recommendedWeather,
        bestSeason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Route ROI GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get ROI score' },
      { status: 500 },
    )
  }
}

// POST /api/route-roi — Create or update ROI score
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { routeId, userId, scores } = body

    if (!routeId) {
      return NextResponse.json(
        { success: false, error: 'routeId is required' },
        { status: 400 },
      )
    }

    // Get or default userId
    let scoreUserId = userId
    if (!scoreUserId) {
      const firstUser = await db.user.findFirst()
      if (!firstUser) {
        return NextResponse.json(
          { success: false, error: 'No users found' },
          { status: 400 },
        )
      }
      scoreUserId = firstUser.id
    }

    // Fetch route for derived calculations
    const route = await db.route.findUnique({ where: { id: routeId } })
    if (!route) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 },
      )
    }

    const category = route.category || 'scenic'
    const difficulty = route.difficulty || 'medium'
    const distance = route.distance || 50

    // User-provided scores (with defaults)
    const sceneryScore = scores?.sceneryScore ?? 5
    const twistinessScore = scores?.twistinessScore ?? 5
    const roadQualityScore = scores?.roadQualityScore ?? 5

    // Auto-calculated scores
    const weatherScore = deriveWeatherScore(category)
    const timePerKm = estimateTimePerKm(category, difficulty)
    const fuelEfficiencyScore = calcFuelEfficiencyScore(distance, category)
    const timeEfficiencyScore = calcTimeEfficiencyScore(timePerKm)

    const overallRoi = calcOverallRoi(
      sceneryScore, twistinessScore, roadQualityScore,
      weatherScore, fuelEfficiencyScore, timeEfficiencyScore,
    )

    const fuelCost = calcFuelCost(distance)
    const recommendedWeather = WEATHER_BY_CATEGORY[category] || 'clear'

    // Parse waypoints for lat
    let startLat = 46.0
    try {
      const wps = typeof route.waypoints === 'string' ? JSON.parse(route.waypoints) : route.waypoints
      if (Array.isArray(wps) && wps.length > 0 && wps[0].lat) {
        startLat = wps[0].lat
      }
    } catch { /* use default */ }
    const bestSeason = deriveBestSeason(startLat, 0)

    // Count POIs near the route
    const poiCount = await db.poi.count()

    // Upsert: create or update if exists for routeId+userId
    const existing = await db.routeRoiScore.findUnique({
      where: { routeId_userId: { routeId, userId: scoreUserId } },
    })

    let result
    if (existing) {
      result = await db.routeRoiScore.update({
        where: { id: existing.id },
        data: {
          sceneryScore,
          twistinessScore,
          roadQualityScore,
          weatherScore,
          fuelEfficiencyScore,
          timeEfficiencyScore,
          overallRoi,
          timePerKm,
          fuelCost,
          pointsOfInterest: poiCount,
          recommendedWeather,
          bestSeason,
        },
      })
    } else {
      result = await db.routeRoiScore.create({
        data: {
          routeId,
          userId: scoreUserId,
          sceneryScore,
          twistinessScore,
          roadQualityScore,
          weatherScore,
          fuelEfficiencyScore,
          timeEfficiencyScore,
          overallRoi,
          timePerKm,
          fuelCost,
          pointsOfInterest: poiCount,
          recommendedWeather,
          bestSeason,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        routeId: result.routeId,
        userId: result.userId,
        sceneryScore: result.sceneryScore,
        twistinessScore: result.twistinessScore,
        roadQualityScore: result.roadQualityScore,
        weatherScore: result.weatherScore,
        fuelEfficiencyScore: result.fuelEfficiencyScore,
        timeEfficiencyScore: result.timeEfficiencyScore,
        overallRoi: result.overallRoi,
        timePerKm: result.timePerKm ?? 0,
        fuelCost: result.fuelCost ?? 0,
        pointsOfInterest: result.pointsOfInterest,
        recommendedWeather: result.recommendedWeather ?? '',
        bestSeason: result.bestSeason ?? '',
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Route ROI POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create/update ROI score' },
      { status: 500 },
    )
  }
}
