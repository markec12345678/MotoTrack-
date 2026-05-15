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

// Severity order for comparison
const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, extreme: 4 }

function getMoreSevere(a: WeatherAlertResult, b: WeatherAlertResult): WeatherAlertResult {
  return (severityOrder[b.severity] || 0) > (severityOrder[a.severity] || 0) ? b : a
}

/**
 * Fetch weather alerts for a single point
 */
async function fetchAlertsForPoint(
  lat: number,
  lng: number,
  alertRadius: number
): Promise<WeatherAlertResult[]> {
  const alerts: WeatherAlertResult[] = []

  // Fetch current weather from Open-Meteo
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=3`

  const weatherRes = await fetch(weatherUrl, { next: { revalidate: 600 } })
  if (!weatherRes.ok) return alerts

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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
      startTime: now, endTime: in24h,
      source: 'Open-Meteo',
    })
  }

  // Snow detection: temperature < 2°C AND precipitation > 0 → likely snow
  if (temp < 2 && precip > 0) {
    if (temp < -5 && precip > 5) {
      alerts.push({
        id: 'snow-extreme',
        type: 'snow',
        severity: 'extreme',
        title: 'Ekstremno sneženje',
        description: `Temperatura ${Math.round(temp)}°C s padavinami ${precip.toFixed(1)} mm - močno sneženje! Ne peljite!`,
        lat, lng, radius: alertRadius,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else if (precip > 3) {
      alerts.push({
        id: 'snow-high',
        type: 'snow',
        severity: 'high',
        title: 'Sneženje',
        description: `Temperatura ${Math.round(temp)}°C s padavinami ${precip.toFixed(1)} mm - sneženje, drsna cesta!`,
        lat, lng, radius: alertRadius,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    } else {
      alerts.push({
        id: 'snow-low',
        type: 'snow',
        severity: 'medium',
        title: 'Možno sneženje',
        description: `Temperatura ${Math.round(temp)}°C s padavinami ${precip.toFixed(1)} mm - možno sneženje, pazite na drsne odseke.`,
        lat, lng, radius: alertRadius,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
      startTime: now, endTime: in24h,
      source: 'Open-Meteo',
    })
  }

  // Improved fog detection: weather codes 45 (fog) and 48 (depositing rime fog)
  if (weatherCode === 45) {
    // Only add if not already added by drizzle fog codes 51-57
    if (!alerts.find(a => a.id === 'fog-medium')) {
      alerts.push({
        id: 'fog-code45',
        type: 'fog',
        severity: 'medium',
        title: 'Megla',
        description: 'Megla v okolici - slaba vidljivost, zmanjšajte hitrost in vklopite dolge luči.',
        lat, lng, radius: alertRadius,
        startTime: now, endTime: in24h,
        source: 'Open-Meteo',
      })
    }
  } else if (weatherCode === 48) {
    // Deposit rime fog - more dangerous, icy conditions possible
    alerts.push({
      id: 'fog-rime-code48',
      type: 'fog',
      severity: 'high',
      title: 'Megla z obledenitvijo',
      description: 'Megla z obledenitvijo - izjemno slaba vidljivost, možna poledica na cesti! Bodite zelo previdni!',
      lat, lng, radius: alertRadius,
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
          lat, lng, radius: alertRadius,
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
          lat, lng, radius: alertRadius,
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
          lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
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
      lat, lng, radius: alertRadius,
      startTime: now, endTime: in24h,
      source: 'Open-Meteo',
    })
  }

  return alerts
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')

    if (!lat || !lng) {
      return NextResponse.json({ data: [] })
    }

    // Radius query parameter affects the alert radius (in km)
    const radiusParam = parseFloat(searchParams.get('radius') || '50')
    // Convert km-based radius to actual radius value for alerts
    // The radius field in alerts represents the area of influence in km
    const alertRadius = radiusParam

    // Check for along_route mode: if waypoints are provided, check weather at multiple points
    const waypointsParam = searchParams.get('waypoints')
    if (waypointsParam) {
      try {
        const waypoints: { lat: number; lng: number }[] = JSON.parse(waypointsParam)
        if (!Array.isArray(waypoints) || waypoints.length < 1) {
          return NextResponse.json({ data: [], error: 'waypoints must be a non-empty array' }, { status: 400 })
        }

        // Sample waypoints to check (max 5 points to avoid too many API calls)
        const maxSamples = 5
        const sampleIndices: number[] = []
        if (waypoints.length <= maxSamples) {
          // Check all waypoints
          for (let i = 0; i < waypoints.length; i++) sampleIndices.push(i)
        } else {
          // Always include first and last, distribute the rest evenly
          sampleIndices.push(0)
          for (let i = 1; i < maxSamples - 1; i++) {
            const idx = Math.round((i / (maxSamples - 1)) * (waypoints.length - 1))
            sampleIndices.push(idx)
          }
          sampleIndices.push(waypoints.length - 1)
        }

        // Fetch weather alerts for each sampled waypoint
        const allAlerts: WeatherAlertResult[] = []
        for (const idx of sampleIndices) {
          const wp = waypoints[idx]
          if (wp.lat && wp.lng) {
            try {
              const wpAlerts = await fetchAlertsForPoint(wp.lat, wp.lng, alertRadius)
              allAlerts.push(...wpAlerts)
            } catch {
              // Skip this waypoint on error
            }
          }
        }

        // Find the most severe alert across all route points
        // Group by type and keep only the most severe of each type
        const mostSevereByType = new Map<string, WeatherAlertResult>()
        for (const alert of allAlerts) {
          const existing = mostSevereByType.get(alert.type)
          if (!existing || severityOrder[alert.severity] > severityOrder[existing.severity]) {
            mostSevereByType.set(alert.type, alert)
          }
        }

        const result = Array.from(mostSevereByType.values())
        return NextResponse.json({
          data: result,
          mode: 'along_route',
          pointsChecked: sampleIndices.length,
        })
      } catch {
        // Invalid waypoints JSON, fall through to single-point mode
      }
    }

    // Single-point mode (default)
    const alerts = await fetchAlertsForPoint(lat, lng, alertRadius)
    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('Weather alerts error:', error)
    return NextResponse.json({ data: [] })
  }
}
