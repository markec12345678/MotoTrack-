import { NextRequest, NextResponse } from 'next/server'

// GET /api/weather - Get weather for coordinates
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: 'lat and lng query parameters are required' },
        { status: 400 }
      )
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { success: false, error: 'Invalid lat or lng values' },
        { status: 400 }
      )
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, error: 'Coordinates out of range' },
        { status: 400 }
      )
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=3`

    const response = await fetch(url, {
      next: { revalidate: 600 }, // Cache for 10 minutes
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo API returned ${response.status}`)
    }

    const data = await response.json()

    // Format the weather data into a clean structure
    const formatted = {
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
      },
      current: data.current_weather
        ? {
            temperature: data.current_weather.temperature,
            windspeed: data.current_weather.windspeed,
            winddirection: data.current_weather.winddirection,
            weathercode: data.current_weather.weathercode,
            time: data.current_weather.time,
            description: getWeatherDescription(data.current_weather.weathercode),
          }
        : null,
      forecast: data.daily
        ? data.daily.time.map((date: string, i: number) => ({
            date,
            tempMax: data.daily.temperature_2m_max[i],
            tempMin: data.daily.temperature_2m_min[i],
            precipitation: data.daily.precipitation_sum[i],
            windMax: data.daily.windspeed_10m_max[i],
            description: getWeatherDescription(
              inferDailyWeatherCode(
                data.daily.precipitation_sum[i],
                data.daily.windspeed_10m_max[i]
              )
            ),
          }))
        : [],
    }

    return NextResponse.json({
      success: true,
      data: formatted,
    })
  } catch (error) {
    console.error('Fetch weather error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}

// WMO Weather interpretation codes
function getWeatherDescription(code: number): string {
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

// Infer a rough weather code for daily forecasts from precipitation and wind
function inferDailyWeatherCode(precipitation: number, windSpeed: number): number {
  if (precipitation > 10) return 65 // Heavy rain
  if (precipitation > 3) return 63 // Moderate rain
  if (precipitation > 0.5) return 61 // Slight rain
  if (windSpeed > 50) return 3 // Overcast / windy
  if (windSpeed > 30) return 2 // Partly cloudy
  return 1 // Mainly clear
}
