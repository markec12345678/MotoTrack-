import { NextRequest, NextResponse } from 'next/server'

// GET /api/weather-along-route?waypoints=[{lat,lng},...]
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const waypointsParam = searchParams.get('waypoints')

    if (!waypointsParam) {
      return NextResponse.json(
        { success: false, error: 'waypoints query parameter is required (JSON array of {lat, lng})' },
        { status: 400 }
      )
    }

    let waypoints: Array<{ lat: number; lng: number }>
    try {
      waypoints = JSON.parse(waypointsParam)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid waypoints JSON format' },
        { status: 400 }
      )
    }

    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      return NextResponse.json(
        { success: false, error: 'waypoints must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate each waypoint
    for (const wp of waypoints) {
      if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Each waypoint must have numeric lat and lng' },
          { status: 400 }
        )
      }
      if (wp.lat < -90 || wp.lat > 90 || wp.lng < -180 || wp.lng > 180) {
        return NextResponse.json(
          { success: false, error: 'Coordinates out of range' },
          { status: 400 }
        )
      }
    }

    // Sample evenly if more than 5 points
    const maxPoints = 5
    const sampledPoints = waypoints.length <= maxPoints
      ? waypoints
      : sampleEvenly(waypoints, maxPoints)

    // Fetch weather for each point sequentially to avoid overwhelming
    const results: Array<{ lat: number; lng: number; temperature: number | null; windspeed: number | null; weathercode: number | null; description: string; windDirection: number | null; precipitation: number | null; isWindDangerous: boolean }> = []
    for (const point of sampledPoints) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}&current_weather=true&hourly=precipitation&timezone=auto&forecast_days=1`

        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000), // 8 second timeout
        })

        if (!response.ok) {
          results.push({
            lat: point.lat,
            lng: point.lng,
            temperature: null,
            windspeed: null,
            weathercode: null,
            description: 'Napaka pri pridobivanju',
            windDirection: null,
            precipitation: null,
            isWindDangerous: false,
          })
          continue
        }

        const data = await response.json()
        const current = data.current_weather

        // Get current precipitation from hourly data
        let precipitation = 0
        if (data.hourly?.precipitation && data.hourly?.time && current?.time) {
          const currentHour = current.time.substring(0, 13)
          const hourIndex = data.hourly.time.findIndex(
            (t: string) => t.substring(0, 13) === currentHour
          )
          if (hourIndex >= 0) {
            precipitation = data.hourly.precipitation[hourIndex] || 0
          }
        }

        const windspeed = current?.windspeed ?? null
        const weathercode = current?.weathercode ?? null

        results.push({
          lat: point.lat,
          lng: point.lng,
          temperature: current?.temperature ?? null,
          windspeed,
          weathercode,
          description: getWeatherDescription(weathercode),
          windDirection: current?.winddirection ?? null,
          precipitation,
          isWindDangerous: windspeed !== null && windspeed > 40,
        })
      } catch {
        results.push({
          lat: point.lat,
          lng: point.lng,
          temperature: null,
          windspeed: null,
          weathercode: null,
          description: 'Napaka',
          windDirection: null,
          precipitation: null,
          isWindDangerous: false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('Weather along route error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather along route' },
      { status: 500 }
    )
  }
}

// Sample evenly from an array (pick `count` items evenly distributed)
function sampleEvenly<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return arr
  const result: T[] = []
  // Always include first and last points
  result.push(arr[0])
  for (let i = 1; i < count - 1; i++) {
    const index = Math.round((i * (arr.length - 1)) / (count - 1))
    result.push(arr[index])
  }
  result.push(arr[arr.length - 1])
  return result
}

// WMO Weather interpretation codes — Slovenian descriptions
// (Same mapping as /api/weather route)
function getWeatherDescription(code: number | null): string {
  if (code === null) return 'Neznano'
  const descriptions: Record<number, string> = {
    0: 'Jasno',
    1: 'Pretežno jasno',
    2: 'Delno oblačno',
    3: 'Oblačno',
    45: 'Megleno',
    48: 'Megla z obledico',
    51: 'Rahlo pršenje',
    53: 'Zmerno pršenje',
    55: 'Gosto pršenje',
    56: 'Rahlo zmrzujoče pršenje',
    57: 'Gosto zmrzujoče pršenje',
    61: 'Rahel dež',
    63: 'Zmeren dež',
    65: 'Močan dež',
    66: 'Rahel zmrzujoč dež',
    67: 'Močan zmrzujoč dež',
    71: 'Rahel sneg',
    73: 'Zmeren sneg',
    75: 'Močan sneg',
    77: 'Snena zrnca',
    80: 'Rahli ploški',
    81: 'Zmerni ploški',
    82: 'Močni ploški',
    85: 'Rahlo sneženje',
    86: 'Močno sneženje',
    95: 'Nevihta',
    96: 'Nevihta s točo',
    99: 'Nevihta s hudo točo',
  }
  return descriptions[code] || 'Neznano'
}
