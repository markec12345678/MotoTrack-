import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface WeatherAlert {
  type: 'storm' | 'heavy_rain' | 'ice' | 'thunderstorm'
  severity: 'warning' | 'danger' | 'extreme'
  title: string
  description: string
  lat: number
  lng: number
  radius: number
  expiresAt: string
  source: string
}

interface OpenMeteoResponse {
  current?: {
    wind_speed_10m?: number
    precipitation?: number
    temperature_2m?: number
    weather_code?: number
  }
}

// WMO Weather codes that indicate thunderstorms
const THUNDERSTORM_CODES = new Set([95, 96, 99])

// GET /api/weather-alerts - Fetch weather alerts for a region
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = parseFloat(searchParams.get('radius') || '100')

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: lat, lng' },
        { status: 400 }
      )
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    // Fetch current weather from Open-Meteo API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=wind_speed_10m,precipitation,temperature_2m,weather_code`
    
    let weatherData: OpenMeteoResponse = {}
    
    try {
      const response = await fetch(weatherUrl, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      })
      
      if (response.ok) {
        weatherData = await response.json()
      }
    } catch (fetchError) {
      console.error('Weather API fetch error:', fetchError)
      // Return empty alerts if API is unavailable
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Weather data temporarily unavailable',
      })
    }

    const alerts: WeatherAlert[] = []
    const current = weatherData.current
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now

    if (!current) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No current weather data available',
      })
    }

    // Check for storm (wind speed > 60 km/h)
    const windSpeed = current.wind_speed_10m
    if (windSpeed !== undefined && windSpeed > 60) {
      alerts.push({
        type: 'storm',
        severity: windSpeed > 90 ? 'extreme' : windSpeed > 75 ? 'danger' : 'warning',
        title: windSpeed > 90 ? 'Extreme Wind Storm' : windSpeed > 75 ? 'Dangerous Wind Storm' : 'High Wind Warning',
        description: `Wind speed of ${Math.round(windSpeed)} km/h detected. Motorcycling is ${windSpeed > 90 ? 'extremely dangerous' : 'hazardous'}. Consider sheltering and avoiding exposed roads.`,
        lat: latitude,
        lng: longitude,
        radius,
        expiresAt,
        source: 'Open-Meteo',
      })
    }

    // Check for heavy rain (precipitation > 10mm)
    const precipitation = current.precipitation
    if (precipitation !== undefined && precipitation > 10) {
      alerts.push({
        type: 'heavy_rain',
        severity: precipitation > 25 ? 'extreme' : precipitation > 15 ? 'danger' : 'warning',
        title: precipitation > 25 ? 'Extreme Rainfall' : precipitation > 15 ? 'Dangerous Heavy Rain' : 'Heavy Rain Warning',
        description: `Precipitation rate of ${precipitation.toFixed(1)} mm/h detected. Roads may be slippery with reduced visibility. Reduce speed and increase following distance.`,
        lat: latitude,
        lng: longitude,
        radius,
        expiresAt,
        source: 'Open-Meteo',
      })
    }

    // Check for ice (temperature < 0°C)
    const temperature = current.temperature_2m
    if (temperature !== undefined && temperature < 0) {
      alerts.push({
        type: 'ice',
        severity: temperature < -10 ? 'extreme' : temperature < -5 ? 'danger' : 'warning',
        title: temperature < -10 ? 'Extreme Ice Conditions' : temperature < -5 ? 'Severe Black Ice Danger' : 'Black Ice Warning',
        description: `Temperature is ${Math.round(temperature)}°C. Black ice is likely on roads, especially on bridges and shaded areas. Exercise extreme caution or delay travel.`,
        lat: latitude,
        lng: longitude,
        radius,
        expiresAt,
        source: 'Open-Meteo',
      })
    }

    // Check for thunderstorm (WMO weather codes)
    const weatherCode = current.weather_code
    if (weatherCode !== undefined && THUNDERSTORM_CODES.has(weatherCode)) {
      alerts.push({
        type: 'thunderstorm',
        severity: weatherCode >= 96 ? 'extreme' : 'danger',
        title: weatherCode >= 96 ? 'Severe Thunderstorm with Hail' : 'Thunderstorm Warning',
        description: weatherCode >= 96
          ? 'Thunderstorm with hail detected. Extremely dangerous for motorcyclists. Seek shelter immediately and avoid open areas.'
          : 'Thunderstorm activity detected. Lightning, heavy rain, and gusty winds possible. Seek shelter and avoid riding.',
        lat: latitude,
        lng: longitude,
        radius,
        expiresAt,
        source: 'Open-Meteo',
      })
    }

    return NextResponse.json({
      success: true,
      data: alerts,
      count: alerts.length,
      currentConditions: {
        temperature: temperature ?? null,
        windSpeed: windSpeed ?? null,
        precipitation: precipitation ?? null,
        weatherCode: weatherCode ?? null,
      },
    })
  } catch (error) {
    console.error('Weather alerts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather alerts' },
      { status: 500 }
    )
  }
}
