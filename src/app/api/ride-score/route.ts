import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ScoreFactor {
  name: string
  impact: number
  value: string
  description: string
  emoji: string
}

// GET /api/ride-score - Daily motorcycle ride safety score based on weather
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

    // Fetch current weather + daily forecast from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,windgusts_10m_max&timezone=auto&forecast_days=1`

    const response = await fetch(url, {
      next: { revalidate: 600 },
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo API returned ${response.status}`)
    }

    const data = await response.json()

    const current = data.current_weather
    const daily = data.daily

    // Current conditions
    const currentTemp = current?.temperature ?? 20
    const currentWind = current?.windspeed ?? 0
    const currentCode = current?.weathercode ?? 0

    // Daily max
    const maxWind = daily?.windspeed_10m_max?.[0] ?? currentWind
    const maxGust = daily?.windgusts_10m_max?.[0] ?? maxWind * 1.3
    const precipitation = daily?.precipitation_sum?.[0] ?? 0
    const tempMax = daily?.temperature_2m_max?.[0] ?? currentTemp
    const tempMin = daily?.temperature_2m_min?.[0] ?? currentTemp

    // Calculate score — start at 10, subtract penalties
    let score = 10
    const factors: ScoreFactor[] = []

    // === WIND ===
    if (maxGust > 80) {
      score -= 4
      factors.push({ name: 'Veter', impact: -4, value: `${Math.round(maxGust)} km/h sunki`, description: 'Zelo nevarni sunki vetra! Ne vozite!', emoji: '🌪️' })
    } else if (maxWind > 60 || maxGust > 60) {
      score -= 3
      factors.push({ name: 'Veter', impact: -3, value: `${Math.round(maxWind)} km/h`, description: 'Zelo močan veter, nevarno za vožnjo', emoji: '🌬️' })
    } else if (maxWind > 40) {
      score -= 2
      factors.push({ name: 'Veter', impact: -2, value: `${Math.round(maxWind)} km/h`, description: 'Močan veter, previdnost pri odprtih odsekih', emoji: '🌬️' })
    } else if (maxWind > 25) {
      score -= 1
      factors.push({ name: 'Veter', impact: -1, value: `${Math.round(maxWind)} km/h`, description: 'Zmeren veter, bodite pozorni', emoji: '💨' })
    }

    // === PRECIPITATION ===
    if (precipitation > 15) {
      score -= 4
      factors.push({ name: 'Padavine', impact: -4, value: `${precipitation.toFixed(1)} mm`, description: 'Izjemno močne padavine, ne vozite!', emoji: '🌧️' })
    } else if (precipitation > 10) {
      score -= 3
      factors.push({ name: 'Padavine', impact: -3, value: `${precipitation.toFixed(1)} mm`, description: 'Močan dež, zelo nevarno', emoji: '🌧️' })
    } else if (precipitation > 3) {
      score -= 2
      factors.push({ name: 'Padavine', impact: -2, value: `${precipitation.toFixed(1)} mm`, description: 'Zmeren dež, cesta je mokra', emoji: '🌦️' })
    } else if (precipitation > 0.5) {
      score -= 1
      factors.push({ name: 'Padavine', impact: -1, value: `${precipitation.toFixed(1)} mm`, description: 'Rahel dež, previdnost', emoji: '🌦️' })
    }

    // === TEMPERATURE ===
    if (tempMin < -5) {
      score -= 3
      factors.push({ name: 'Temperatura', impact: -3, value: `${Math.round(tempMin)}°C`, description: 'Pozena, cesta je lahko poledenela!', emoji: '🥶' })
    } else if (tempMin < 0) {
      score -= 2
      factors.push({ name: 'Temperatura', impact: -2, value: `${Math.round(tempMin)}°C`, description: 'Pod ničlo, možna poledica', emoji: '❄️' })
    } else if (tempMin < 5) {
      score -= 1
      factors.push({ name: 'Temperatura', impact: -1, value: `${Math.round(tempMin)}°C`, description: 'Hladno, oblecite se toplo', emoji: '🧊' })
    }
    if (tempMax > 38) {
      score -= 2
      factors.push({ name: 'Vročina', impact: -2, value: `${Math.round(tempMax)}°C`, description: 'Izjemna vročina, nevarnost dehidracije', emoji: '🔥' })
    } else if (tempMax > 35) {
      score -= 1
      factors.push({ name: 'Vročina', impact: -1, value: `${Math.round(tempMax)}°C`, description: 'Vroče, poskrbite za hidracijo', emoji: '🌡️' })
    }

    // === WEATHER CODE ===
    if (currentCode >= 95) {
      score -= 3
      factors.push({ name: 'Nevihta', impact: -3, value: getWeatherDescription(currentCode), description: 'Nevihta, ne vozite!', emoji: '⛈️' })
    } else if (currentCode >= 85) {
      score -= 2
      factors.push({ name: 'Sneg', impact: -2, value: getWeatherDescription(currentCode), description: 'Sneženje, zelo nevarno', emoji: '🌨️' })
    } else if (currentCode >= 71) {
      score -= 2
      factors.push({ name: 'Sneg', impact: -2, value: getWeatherDescription(currentCode), description: 'Sneg na cesti', emoji: '❄️' })
    } else if (currentCode >= 45 && currentCode <= 48) {
      score -= 1
      factors.push({ name: 'Megla', impact: -1, value: getWeatherDescription(currentCode), description: 'Megla, zmanjšana vidljivost', emoji: '🌫️' })
    } else if (currentCode >= 61 && currentCode <= 67) {
      // Rain already handled by precipitation, but add factor if not already
      if (precipitation <= 0.5) {
        score -= 1
        factors.push({ name: 'Dež', impact: -1, value: getWeatherDescription(currentCode), description: 'Dež, cesta je mokra', emoji: '🌧️' })
      }
    }

    // Clamp score
    score = Math.max(1, Math.min(10, score))

    // Determine label and color
    let label: string
    let color: string
    let bgClass: string

    if (score >= 9) {
      label = 'Odlično'
      color = '#10b981'
      bgClass = 'bg-emerald-500'
    } else if (score >= 7) {
      label = 'Dobro'
      color = '#22c55e'
      bgClass = 'bg-green-500'
    } else if (score >= 5) {
      label = 'Zmerno'
      color = '#eab308'
      bgClass = 'bg-yellow-500'
    } else if (score >= 3) {
      label = 'Slabo'
      color = '#f97316'
      bgClass = 'bg-orange-500'
    } else {
      label = 'Nevarno'
      color = '#ef4444'
      bgClass = 'bg-red-500'
    }

    // Generate recommendation
    let recommendation: string
    if (score >= 9) {
      recommendation = 'Idealen dan za vožnjo! Uživajte na cesti. 🏍️'
    } else if (score >= 7) {
      recommendation = 'Dobri pogoji za vožnjo, bodite pozorni na vreme.'
    } else if (score >= 5) {
      recommendation = 'Zmerni pogoji. Preverite opremo in bodite previdni.'
    } else if (score >= 3) {
      recommendation = 'Slabi pogoji. Razmislite o odpovedi vožnje.'
    } else {
      recommendation = 'Nevarni pogoji! Odložite vožnjo za drugi dan. ⚠️'
    }

    return NextResponse.json({
      success: true,
      data: {
        score,
        label,
        color,
        bgClass,
        factors,
        recommendation,
        currentWeather: {
          temperature: currentTemp,
          windspeed: currentWind,
          winddirection: current?.winddirection ?? 0,
          weathercode: currentCode,
          description: getWeatherDescription(currentCode),
          maxWind: Math.round(maxWind),
          maxGust: Math.round(maxGust),
          precipitation: Math.round(precipitation * 10) / 10,
          tempMax: Math.round(tempMax),
          tempMin: Math.round(tempMin),
        },
        location: {
          latitude,
          longitude,
        },
      },
    })
  } catch (error) {
    console.error('Ride score error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate ride score' },
      { status: 500 }
    )
  }
}

function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Jasno', 1: 'Pretežno jasno', 2: 'Delno oblačno', 3: 'Oblačno',
    45: 'Megleno', 48: 'Megla z obledico',
    51: 'Rahlo pršenje', 53: 'Zmerno pršenje', 55: 'Gosto pršenje',
    56: 'Rahlo zmrzujoče pršenje', 57: 'Gosto zmrzujoče pršenje',
    61: 'Rahel dež', 63: 'Zmeren dež', 65: 'Močan dež',
    66: 'Rahel zmrzujoč dež', 67: 'Močan zmrzujoč dež',
    71: 'Rahel sneg', 73: 'Zmeren sneg', 75: 'Močan sneg',
    77: 'Snežna zrnca', 80: 'Rahli ploški', 81: 'Zmerni ploški', 82: 'Močni ploški',
    85: 'Rahlo sneženje', 86: 'Močno sneženje',
    95: 'Nevihta', 96: 'Nevihta s točo', 99: 'Nevihta s hudo točo',
  }
  return descriptions[code] || 'Neznano'
}
