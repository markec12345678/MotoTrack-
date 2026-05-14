import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface WeatherAlertResult {
  id: string
  type: 'wind' | 'rain' | 'storm' | 'ice' | 'fog' | 'heat' | 'snow'
  severity: 'low' | 'medium' | 'high' | 'extreme'
  title: string
  description: string
  lat: number
  lng: number
  radius: number
  startTime: string
  endTime: string
  source: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')

    if (!lat || !lng) {
      return NextResponse.json({ data: [] })
    }

    const alerts: WeatherAlertResult[] = []

    // Fetch current weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=3`

    const weatherRes = await fetch(weatherUrl, { next: { revalidate: 600 } })
    if (!weatherRes.ok) {
      return NextResponse.json({ data: [] })
    }

    const weather = await weatherRes.json()
    const current = weather.current || {}
    const daily = weather.daily || {}

    const now = new Date().toISOString()
    const in24h = new Date(Date.now() + 86400000).toISOString()

    // Check current wind speed
    const windSpeed = current.wind_speed_10m || 0
    if (windSpeed > 80) {
      alerts.push({
        id: 'wind-extreme',
        type: 'wind',
        severity: 'extreme',
        title: 'Ekstremno močan veter',
        description: `Hitrost vetra ${Math.round(windSpeed)} km/h - izjemno nevarno za motocikle! Ne peljite!`,
        lat, lng, radius: 30,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (windSpeed > 60) {
      alerts.push({
        id: 'wind-high',
        type: 'wind',
        severity: 'high',
        title: 'Močan veter',
        description: `Hitrost vetra ${Math.round(windSpeed)} km/h - nevarno za motocikle. Pazite na postranske sunki!`,
        lat, lng, radius: 30,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (windSpeed > 40) {
      alerts.push({
        id: 'wind-medium',
        type: 'wind',
        severity: 'medium',
        title: 'Zmeren veter',
        description: `Hitrost vetra ${Math.round(windSpeed)} km/h - bodite previdni, zlasti na izpostavljenih odsekih.`,
        lat, lng, radius: 20,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }

    // Check current temperature for ice
    const temp = current.temperature_2m || 0
    if (temp < -5) {
      alerts.push({
        id: 'ice-extreme',
        type: 'ice',
        severity: 'extreme',
        title: 'Ekstremno nizke temperature',
        description: `Temperatura ${Math.round(temp)}°C - poledica, črna led! Ne peljite!`,
        lat, lng, radius: 20,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (temp < 0) {
      alerts.push({
        id: 'ice-high',
        type: 'ice',
        severity: 'high',
        title: 'Nevarnost poledice',
        description: `Temperatura ${Math.round(temp)}°C - možna poledica na cesti, zlasti na mostovih in v senci.`,
        lat, lng, radius: 15,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (temp < 3) {
      alerts.push({
        id: 'ice-low',
        type: 'ice',
        severity: 'low',
        title: 'Nizka temperatura',
        description: `Temperatura ${Math.round(temp)}°C - možna poledica v višjih legah.`,
        lat, lng, radius: 10,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }

    // Check current precipitation
    const precip = current.precipitation || 0
    if (precip > 10) {
      alerts.push({
        id: 'rain-extreme',
        type: 'rain',
        severity: 'extreme',
        title: 'Ekstremno deževje',
        description: `Padavine ${precip.toFixed(1)} mm - zelo slaba vidljivost, nevarnost plazenja!`,
        lat, lng, radius: 20,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (precip > 5) {
      alerts.push({
        id: 'rain-high',
        type: 'rain',
        severity: 'high',
        title: 'Močan dež',
        description: `Padavine ${precip.toFixed(1)} mm - slaba vidljivost, drsna podlaga.`,
        lat, lng, radius: 15,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (precip > 1) {
      alerts.push({
        id: 'rain-low',
        type: 'rain',
        severity: 'low',
        title: 'Dež',
        description: `Padavine ${precip.toFixed(1)} mm - mokra cesta, povečana previdnost.`,
        lat, lng, radius: 10,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }

    // Check weather code for thunderstorm
    const weatherCode = current.weather_code || 0
    if (weatherCode >= 95) {
      alerts.push({
        id: 'storm-extreme',
        type: 'storm',
        severity: 'extreme',
        title: 'Nevihta',
        description: 'Aktivna nevihta v okolici - strela je izjemno nevarna za motoriste! Počakajte!',
        lat, lng, radius: 30,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (weatherCode >= 51 && weatherCode <= 57) {
      alerts.push({
        id: 'fog-medium',
        type: 'fog',
        severity: 'medium',
        title: 'Megla',
        description: 'Slaba vidljivost zaradi megle - zmanjšajte hitrost in vklopite luči.',
        lat, lng, radius: 15,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }

    // Check daily forecast for upcoming alerts
    if (daily && daily.weather_code) {
      for (let i = 1; i < Math.min(3, daily.weather_code.length); i++) {
        const dayCode = daily.weather_code[i]
        const dayWindMax = daily.wind_speed_10m_max?.[i] || 0
        const dayPrecip = daily.precipitation_sum?.[i] || 0
        const dayDate = daily.time?.[i] || ''

        if (dayCode >= 95 && !alerts.find(a => a.type === 'storm')) {
          alerts.push({
            id: `storm-forecast-${i}`,
            type: 'storm',
            severity: 'high',
            title: 'Nevihta napovedana',
            description: `Nevihta napovedana za ${dayDate}. Načrtujte potovanje drugič.`,
            lat, lng, radius: 50,
            startTime: dayDate, endTime: new Date(new Date(dayDate).getTime() + 86400000).toISOString(),
            source: 'Open-Meteo',
          })
        }
        if (dayWindMax > 60 && !alerts.find(a => a.type === 'wind' && a.severity === 'high')) {
          alerts.push({
            id: `wind-forecast-${i}`,
            type: 'wind',
            severity: 'medium',
            title: 'Močan veter napovedan',
            description: `Veter do ${Math.round(dayWindMax)} km/h napovedan za ${dayDate}.`,
            lat, lng, radius: 50,
            startTime: dayDate, endTime: new Date(new Date(dayDate).getTime() + 86400000).toISOString(),
            source: 'Open-Meteo',
          })
        }
        if (dayPrecip > 15 && !alerts.find(a => a.type === 'rain' && a.severity === 'high')) {
          alerts.push({
            id: `rain-forecast-${i}`,
            type: 'rain',
            severity: 'medium',
            title: 'Močne padavine napovedane',
            description: `${dayPrecip.toFixed(0)} mm padavin napovedanih za ${dayDate}.`,
            lat, lng, radius: 50,
            startTime: dayDate, endTime: new Date(new Date(dayDate).getTime() + 86400000).toISOString(),
            source: 'Open-Meteo',
          })
        }
      }
    }

    // Check heat
    if (temp > 38) {
      alerts.push({
        id: 'heat-extreme',
        type: 'heat',
        severity: 'extreme',
        title: 'Ekstremna vročina',
        description: `Temperatura ${Math.round(temp)}°C - nevarnost toplotnega udara! Pijte dovolj vode!`,
        lat, lng, radius: 20,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (temp > 33) {
      alerts.push({
        id: 'heat-medium',
        type: 'heat',
        severity: 'medium',
        title: 'Visoka temperatura',
        description: `Temperatura ${Math.round(temp)}°C - poskrbite za zadosten vnos tekočine.`,
        lat, lng, radius: 15,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }

    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('Weather alerts error:', error)
    return NextResponse.json({ data: [] })
  }
}
