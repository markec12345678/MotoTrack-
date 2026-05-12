import { NextRequest, NextResponse } from 'next/server'

// GET /api/weather - Get weather for coordinates
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
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snowfall',
    73: 'Moderate snowfall',
    75: 'Heavy snowfall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  }
  return descriptions[code] || 'Unknown'
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
