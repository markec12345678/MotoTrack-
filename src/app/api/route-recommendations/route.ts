import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Weather compatibility mapping: how well each weather condition suits each route category
const WEATHER_COMPATIBILITY: Record<string, Record<string, number>> = {
  clear: { scenic: 100, twisty: 95, offroad: 85, city: 80, snowmobile: 30, racetrack: 100, enduro: 80, adventure: 90 },
  partly_cloudy: { scenic: 90, twisty: 90, offroad: 80, city: 85, snowmobile: 40, racetrack: 85, enduro: 75, adventure: 85 },
  cloudy: { scenic: 60, twisty: 70, offroad: 65, city: 80, snowmobile: 50, racetrack: 50, enduro: 60, adventure: 65 },
  dry: { scenic: 85, twisty: 80, offroad: 95, city: 80, snowmobile: 20, racetrack: 80, enduro: 95, adventure: 90 },
  rain: { scenic: 25, twisty: 20, offroad: 15, city: 50, snowmobile: 10, racetrack: 10, enduro: 15, adventure: 20 },
  snow: { scenic: 20, twisty: 10, offroad: 10, city: 30, snowmobile: 95, racetrack: 5, enduro: 10, adventure: 15 },
  fog: { scenic: 30, twisty: 20, offroad: 30, city: 50, snowmobile: 40, racetrack: 15, enduro: 25, adventure: 30 },
  any: { scenic: 70, twisty: 65, offroad: 60, city: 70, snowmobile: 50, racetrack: 60, enduro: 60, adventure: 65 },
}

// Map WMO weather code to a weather category
function weatherCodeToCategory(code: number): string {
  if (code <= 1) return 'clear'
  if (code <= 3) return 'partly_cloudy'
  if (code <= 48) return 'fog'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain'
  return 'rain' // storms
}

// Slovenian reasons for recommendation
function generateReason(roiScore: number, weatherCompat: number, category: string, distance: number): string {
  const reasons: string[] = []

  if (roiScore >= 75) reasons.push('Izjemna pot z visokim ROI')
  else if (roiScore >= 50) reasons.push('Zanimiva pot z dobrim razmerjem')
  else reasons.push('Primerljiva pot za raziskovanje')

  if (weatherCompat >= 80) reasons.push('odlično vreme za to kategorijo')
  else if (weatherCompat >= 50) reasons.push('sprejemljivo vreme')

  const catLabels: Record<string, string> = {
    scenic: 'slikovita', twisty: 'vijugasta', offroad: 'terenska',
    city: 'mestna', snowmobile: 'snežna', racetrack: 'dirkališčna',
    enduro: 'enduro', adventure: 'pustolovska',
  }
  reasons.push(`${catLabels[category] || category} ruta, ${distance.toFixed(0)} km`)

  return reasons.join(', ')
}

// Haversine in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Fetch current weather for a point from Open-Meteo
async function fetchWeather(lat: number, lng: number): Promise<{
  temperature: number
  windspeed: number
  weathercode: number
  description: string
  windDirection: number
  precipitation: number
  isWindDangerous: boolean
} | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation&timezone=auto&forecast_days=1`
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null

    const data = await response.json()
    const current = data.current_weather

    let precipitation = 0
    if (data.hourly?.precipitation && data.hourly?.time && current?.time) {
      const currentHour = current.time.substring(0, 13)
      const hourIndex = data.hourly.time.findIndex(
        (t: string) => t.substring(0, 13) === currentHour,
      )
      if (hourIndex >= 0) {
        precipitation = data.hourly.precipitation[hourIndex] ?? 0
      }
    }

    const descriptions: Record<number, string> = {
      0: 'Jasno', 1: 'Pretežno jasno', 2: 'Delno oblačno', 3: 'Oblačno',
      45: 'Megleno', 48: 'Megla z obledico',
      51: 'Rahlo pršenje', 53: 'Zmerno pršenje', 55: 'Gosto pršenje',
      61: 'Rahel dež', 63: 'Zmeren dež', 65: 'Močan dež',
      71: 'Rahel sneg', 73: 'Zmeren sneg', 75: 'Močan sneg',
      80: 'Rahli ploški', 81: 'Zmerni ploški', 82: 'Močni ploški',
      95: 'Nevihta', 96: 'Nevihta s točo',
    }

    const windspeed = current?.windspeed ?? 0
    return {
      temperature: current?.temperature ?? 0,
      windspeed,
      weathercode: current?.weathercode ?? 0,
      description: descriptions[current?.weathercode] || 'Neznano',
      windDirection: current?.winddirection ?? 0,
      precipitation,
      isWindDangerous: windspeed > 40,
    }
  } catch {
    return null
  }
}

// GET /api/route-recommendations?userId=...&lat=...&lng=...&radius=100&weather=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '100')
    const weatherFilter = searchParams.get('weather') // optional: clear, rain, etc.

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'Valid lat and lng are required' },
        { status: 400 },
      )
    }

    // 1. Get all public routes
    const routes = await db.route.findMany({
      where: { isPublic: true },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        routeRoiScores: userId ? { where: { userId } } : true,
      },
      take: 200,
    })

    // 2. Filter routes within radius and calculate distance
    const routesWithDistance = routes
      .map(route => {
        // Parse first waypoint as start point
        let startLat = lat
        let startLng = lng
        try {
          const wps = typeof route.waypoints === 'string' ? JSON.parse(route.waypoints) : route.waypoints
          if (Array.isArray(wps) && wps.length > 0 && wps[0].lat && wps[0].lng) {
            startLat = wps[0].lat
            startLng = wps[0].lng
          }
        } catch { /* use user position */ }

        const distance = haversineKm(lat, lng, startLat, startLng)
        return { route, distance, startLat, startLng }
      })
      .filter(r => r.distance <= radius)

    if (routesWithDistance.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // 3. Fetch weather for each route's start point (limit to 5 for performance)
    const topRoutes = routesWithDistance.slice(0, 5) // reduced from 20 to prevent timeout

    // Get user's preferred categories if userId provided
    let preferredCategories: string[] = []
    if (userId) {
      try {
        const userRoutes = await db.route.findMany({
          where: { userId },
          select: { category: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
        // Count categories
        const catCounts: Record<string, number> = {}
        for (const r of userRoutes) {
          catCounts[r.category] = (catCounts[r.category] || 0) + 1
        }
        preferredCategories = Object.entries(catCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat]) => cat)
      } catch { /* ignore */ }
    }

    // 4. Calculate weather compatibility and combined scores (sequential to avoid overload)
    const recommendations: Array<{
      routeId: string; route: Record<string, unknown>; roiScore: Record<string, unknown> | null;
      weatherCompatibility: number; distance: number; combinedScore: number;
      weatherAtRoute: Record<string, unknown> | null; reason: string;
    }> = []
    for (const { route, distance, startLat, startLng } of topRoutes) {
        // Fetch current weather for this route
        const weatherAtRoute = await fetchWeather(startLat, startLng)

        // Determine weather category
        const weatherCategory = weatherAtRoute
          ? weatherCodeToCategory(weatherAtRoute.weathercode)
          : 'clear' // default assumption

        // If weather filter is set, skip routes where weather doesn't match
        if (weatherFilter && weatherCategory !== weatherFilter) {
          // Still include but with lower score
        }

        // Calculate weather compatibility
        const category = route.category || 'scenic'
        const compatMap = WEATHER_COMPATIBILITY[weatherCategory] || WEATHER_COMPATIBILITY.clear
        const weatherCompatibility = compatMap[category] ?? 60

        // Get existing ROI score
        const existingRoi = route.routeRoiScores?.[0] ?? null
        const roiValue = existingRoi ? existingRoi.overallRoi : 50 // default if no score

        // Bonus for preferred categories
        const categoryBonus = preferredCategories.includes(category) ? 10 : 0

        // Distance penalty: closer is better
        const distancePenalty = Math.min(30, (distance / radius) * 30)

        // Combined score
        const combinedScore = Math.round(
          roiValue * 0.4 +
          weatherCompatibility * 0.3 +
          categoryBonus +
          (30 - distancePenalty)
        )

        const roiScore = existingRoi ? {
          id: existingRoi.id,
          routeId: existingRoi.routeId,
          userId: existingRoi.userId,
          sceneryScore: existingRoi.sceneryScore,
          twistinessScore: existingRoi.twistinessScore,
          roadQualityScore: existingRoi.roadQualityScore,
          weatherScore: existingRoi.weatherScore,
          fuelEfficiencyScore: existingRoi.fuelEfficiencyScore,
          timeEfficiencyScore: existingRoi.timeEfficiencyScore,
          overallRoi: existingRoi.overallRoi,
          timePerKm: existingRoi.timePerKm ?? 0,
          fuelCost: existingRoi.fuelCost ?? 0,
          pointsOfInterest: existingRoi.pointsOfInterest,
          recommendedWeather: existingRoi.recommendedWeather ?? '',
          bestSeason: existingRoi.bestSeason ?? '',
          createdAt: existingRoi.createdAt.toISOString(),
          updatedAt: existingRoi.updatedAt.toISOString(),
        } : null

        const reason = generateReason(roiValue, weatherCompatibility, category, route.distance)

        recommendations.push({
          routeId: route.id,
          route: {
            id: route.id,
            title: route.title,
            description: route.description ?? undefined,
            distance: route.distance,
            waypoints: route.waypoints,
            routeData: route.routeData,
            category: route.category,
            difficulty: route.difficulty,
            isPublic: route.isPublic,
            likes: route.likes,
            userId: route.userId,
            createdAt: route.createdAt.toISOString(),
            user: route.user,
          },
          roiScore,
          weatherCompatibility,
          distance: Math.round(distance * 10) / 10,
          combinedScore: Math.min(100, combinedScore),
          weatherAtRoute: weatherAtRoute ? {
            lat: startLat,
            lng: startLng,
            temperature: weatherAtRoute.temperature,
            windspeed: weatherAtRoute.windspeed,
            weathercode: weatherAtRoute.weathercode,
            description: weatherAtRoute.description,
            windDirection: weatherAtRoute.windDirection,
            precipitation: weatherAtRoute.precipitation,
            isWindDangerous: weatherAtRoute.isWindDangerous,
          } : null,
          reason,
        })
    }

    // 5. Sort by combined score descending
    recommendations.sort((a, b) => b.combinedScore - a.combinedScore)

    // 6. Return top 10
    return NextResponse.json({
      success: true,
      data: recommendations.slice(0, 10),
    })
  } catch (error) {
    console.error('Route recommendations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get route recommendations' },
      { status: 500 },
    )
  }
}
