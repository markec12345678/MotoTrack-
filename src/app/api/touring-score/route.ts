import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────────────────
interface ScoreBreakdown {
  distance: number      // 0-100
  consistency: number   // 0-100
  variety: number       // 0-100
  challenge: number     // 0-100
  community: number     // 0-100
  safety: number        // 0-100
}

interface TouringScoreResult {
  totalScore: number
  breakdown: ScoreBreakdown
  rank: { key: string; label: string; color: string; emoji: string }
  weeklyTrend: number
  tips: string[]
  stats: {
    totalDistance: number
    totalRides: number
    uniqueRoutes: number
    publicRides: number
    totalLikes: number
    speedWarnings: number
  }
}

// ── Rank System ──────────────────────────────────────────────────────────
const RANKS = [
  { min: 0,   max: 200,  key: 'novice',     label: 'Novinec',     color: '#22c55e', emoji: '🟢' },
  { min: 201, max: 400,  key: 'rider',       label: 'Motorist',    color: '#3b82f6', emoji: '🔵' },
  { min: 401, max: 600,  key: 'tourer',      label: 'Popotnik',    color: '#eab308', emoji: '🟡' },
  { min: 601, max: 800,  key: 'adventurer',  label: 'Pustolovec',  color: '#f97316', emoji: '🟠' },
  { min: 801, max: 1000, key: 'legend',      label: 'Legenda',     color: '#ef4444', emoji: '🔴' },
]

function getRank(score: number) {
  return RANKS.find(r => score >= r.min && score <= r.max) || RANKS[0]
}

// ── Score Calculation ────────────────────────────────────────────────────

function calculateDistanceScore(totalDistanceKm: number): number {
  // Scale: 0km=0, 500km=20, 2000km=50, 5000km=80, 10000km+=100
  if (totalDistanceKm <= 0) return 0
  if (totalDistanceKm >= 10000) return 100
  if (totalDistanceKm >= 5000) return 80 + ((totalDistanceKm - 5000) / 5000) * 20
  if (totalDistanceKm >= 2000) return 50 + ((totalDistanceKm - 2000) / 3000) * 30
  if (totalDistanceKm >= 500) return 20 + ((totalDistanceKm - 500) / 1500) * 30
  return (totalDistanceKm / 500) * 20
}

function calculateConsistencyScore(
  ridesThisWeek: number,
  ridesLastWeek: number,
  uniqueDaysRidden: number,
  totalDays: number
): number {
  // How regularly you ride: frequency + streak
  const frequencyScore = Math.min(ridesThisWeek / 5, 1) * 40 // 5 rides/week = max 40
  const improvementScore = ridesThisWeek >= ridesLastWeek ? 20 : Math.max(0, 20 - (ridesLastWeek - ridesThisWeek) * 5)
  const regularityScore = totalDays > 0 ? Math.min((uniqueDaysRidden / totalDays) * 40, 40) : 0
  return Math.min(frequencyScore + improvementScore + regularityScore, 100)
}

function calculateVarietyScore(uniqueRoutes: number, uniqueCategories: number, uniqueRegions: number): number {
  // Different routes/roads explored
  const routeScore = Math.min(uniqueRoutes / 20, 1) * 40 // 20 unique routes = max 40
  const categoryScore = Math.min(uniqueCategories / 6, 1) * 30 // 6 categories = max 30
  const regionScore = Math.min(uniqueRegions / 5, 1) * 30 // 5 regions = max 30
  return Math.min(routeScore + categoryScore + regionScore, 100)
}

function calculateChallengeScore(
  hardRoutes: number,
  offroadRoutes: number,
  avgMaxSpeed: number,
  weatherRides: number
): number {
  // Difficult roads, weather conditions
  const hardScore = Math.min(hardRoutes / 5, 1) * 30
  const offroadScore = Math.min(offroadRoutes / 5, 1) * 25
  const speedScore = Math.min(avgMaxSpeed / 120, 1) * 20 // 120 km/h avg max = 20
  const weatherScore = Math.min(weatherRides / 10, 1) * 25
  return Math.min(hardScore + offroadScore + speedScore + weatherScore, 100)
}

function calculateCommunityScore(
  totalLikes: number,
  publicRides: number,
  totalRides: number,
  commentsCount: number
): number {
  // Likes, comments, shared rides
  const likeScore = Math.min(totalLikes / 50, 1) * 30
  const sharingScore = totalRides > 0 ? (publicRides / totalRides) * 35 : 0
  const commentScore = Math.min(commentsCount / 20, 1) * 35
  return Math.min(likeScore + sharingScore + commentScore, 100)
}

function calculateSafetyScore(
  speedWarnings: number,
  totalRides: number,
  avgMaxSpeed: number
): number {
  // No speed warnings, smooth riding
  if (totalRides === 0) return 50 // neutral starting point
  const warningRate = speedWarnings / totalRides
  const warningScore = Math.max(0, 50 - warningRate * 25) // each warning per ride reduces score
  const smoothScore = avgMaxSpeed <= 130 ? 30 : avgMaxSpeed <= 160 ? 15 : 0
  const baseScore = 20 // base for having rides without crashes
  return Math.min(warningScore + smoothScore + baseScore, 100)
}

function generateTips(breakdown: ScoreBreakdown, rank: typeof RANKS[0], nextRank: typeof RANKS[0] | null): string[] {
  const tips: string[] = []

  if (nextRank) {
    const scoreNeeded = nextRank.min - (breakdown.distance * 0.2 + breakdown.consistency * 0.2 + breakdown.variety * 0.15 + breakdown.challenge * 0.15 + breakdown.community * 0.15 + breakdown.safety * 0.15)
    tips.push(`Do ${nextRank.label} potrebujete še ${Math.ceil(scoreNeeded)} točk`)
  }

  if (breakdown.distance < 40) tips.push('Povečajte skupno razdaljo — ciljajte na 500+ km')
  if (breakdown.consistency < 40) tips.push('Sledite redno — vsaj 3 vožnje na teden')
  if (breakdown.variety < 40) tips.push('Raziskujte nove poti in kategorije')
  if (breakdown.challenge < 40) tips.push('Preizkusite zahtevnejše poti ali vožnje v slabem vremenu')
  if (breakdown.community < 40) tips.push('Delite vožnje javno in komentirajte prijateljem')
  if (breakdown.safety < 60) tips.push('Bodite pozorni na omejitve hitrosti za višjo oceno varnosti')

  if (tips.length === 0) tips.push('Odlično! Ste vrhunski motorist!')

  return tips.slice(0, 4)
}

// ── GET Handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId je obvezen parameter' },
        { status: 400 }
      )
    }

    // Fetch user's rides
    const rides = await db.ride.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch user's routes
    const routes = await db.route.findMany({
      where: { userId },
    })

    // Fetch user's comments
    const commentsCount = await db.comment.count({
      where: { userId },
    })

    // Fetch likes received on user's routes
    const likesReceived = await db.like.count({
      where: { route: { userId } },
    })

    // ── Calculate stats ────────────────────────────────────────────────
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0)
    const totalRides = rides.length
    const publicRides = rides.filter(r => r.isPublic).length

    // This week vs last week rides
    const ridesThisWeek = rides.filter(r => new Date(r.createdAt) >= oneWeekAgo).length
    const ridesLastWeek = rides.filter(r => {
      const d = new Date(r.createdAt)
      return d >= twoWeeksAgo && d < oneWeekAgo
    }).length

    // Unique days ridden (last 30 days)
    const recentRides = rides.filter(r => new Date(r.createdAt) >= thirtyDaysAgo)
    const uniqueDaysRidden = new Set(
      recentRides.map(r => new Date(r.createdAt).toDateString())
    ).size

    // Variety
    const uniqueCategories = new Set(routes.map(r => r.category)).size
    // Estimate unique regions from ride start positions
    const rideRegions = new Set(
      rides
        .filter(r => r.startLat && r.startLng)
        .map(r => `${Math.round((r.startLat ?? 0) * 10)}-${Math.round((r.startLng ?? 0) * 10)}`)
    )
    const uniqueRegions = rideRegions.size

    // Challenge
    const hardRoutes = routes.filter(r => r.difficulty === 'hard').length
    const offroadRoutes = routes.filter(r => r.category === 'offroad' || r.category === 'enduro' || r.category === 'adventure').length
    const avgMaxSpeed = totalRides > 0
      ? rides.reduce((sum, r) => sum + r.maxSpeed, 0) / totalRides
      : 0

    // Estimate weather rides (rides in bad weather conditions - heuristic based on season and time)
    // Since we don't have weather data per ride, estimate from late autumn/winter rides
    const weatherRides = rides.filter(r => {
      const month = new Date(r.createdAt).getMonth()
      return month >= 10 || month <= 2 // Nov-Feb = challenging weather
    }).length

    // Safety - speed warnings based on maxSpeed exceeding typical limits
    const speedLimit = 130 // km/h typical highway limit
    const speedWarnings = rides.filter(r => r.maxSpeed > speedLimit).length

    // ── Calculate scores ───────────────────────────────────────────────
    const distance = Math.round(calculateDistanceScore(totalDistance))
    const consistency = Math.round(calculateConsistencyScore(ridesThisWeek, ridesLastWeek, uniqueDaysRidden, 30))
    const variety = Math.round(calculateVarietyScore(routes.length, uniqueCategories, uniqueRegions))
    const challenge = Math.round(calculateChallengeScore(hardRoutes, offroadRoutes, avgMaxSpeed, weatherRides))
    const community = Math.round(calculateCommunityScore(likesReceived, publicRides, totalRides, commentsCount))
    const safety = Math.round(calculateSafetyScore(speedWarnings, totalRides, avgMaxSpeed))

    const breakdown: ScoreBreakdown = { distance, consistency, variety, challenge, community, safety }

    // Weighted total: 20%+20%+15%+15%+15%+15% = 100% → scale to 0-1000
    const rawScore = distance * 0.20 + consistency * 0.20 + variety * 0.15 + challenge * 0.15 + community * 0.15 + safety * 0.15
    const totalScore = Math.round(rawScore * 10) // 0-100 → 0-1000

    const rank = getRank(totalScore)
    const rankIndex = RANKS.indexOf(rank)
    const nextRank = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1] : null

    // ── Weekly trend ───────────────────────────────────────────────────
    // Calculate score for last week (same formula but with previous week's data)
    const lastWeekRides = rides.filter(r => new Date(r.createdAt) < oneWeekAgo)
    const lastWeekDistance = lastWeekRides.reduce((sum, r) => sum + r.distance, 0)
    const lastWeekDistanceScore = calculateDistanceScore(lastWeekDistance)
    const lastWeekConsistency = calculateConsistencyScore(ridesLastWeek, 0, uniqueDaysRidden, 30)
    const lastWeekRaw = lastWeekDistanceScore * 0.20 + lastWeekConsistency * 0.20 + variety * 0.15 + challenge * 0.15 + community * 0.15 + safety * 0.15
    const lastWeekTotal = Math.round(lastWeekRaw * 10)
    const weeklyTrend = totalScore - lastWeekTotal

    // ── Tips ───────────────────────────────────────────────────────────
    const tips = generateTips(breakdown, rank, nextRank)

    const result: TouringScoreResult = {
      totalScore,
      breakdown,
      rank: { key: rank.key, label: rank.label, color: rank.color, emoji: rank.emoji },
      weeklyTrend,
      tips,
      stats: {
        totalDistance: Math.round(totalDistance),
        totalRides,
        uniqueRoutes: routes.length,
        publicRides,
        totalLikes: likesReceived,
        speedWarnings,
      },
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[Touring Score] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Napaka pri izračunu ocene' },
      { status: 500 }
    )
  }
}
