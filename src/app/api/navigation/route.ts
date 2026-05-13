import { NextRequest, NextResponse } from 'next/server'

const TURN_SLOVENIAN: Record<string, string> = {
  'turn': 'Zavij',
  'new name': 'Nadaljuj',
  'depart': 'Kreni',
  'arrive': 'Prispeli ste',
  'merge': 'Združi se',
  'fork': 'Na razcepu',
  'roundabout': 'Krožišče',
  'rotary': 'Krožišče',
  'continue': 'Nadaljuj naravnost',
}

const MODIFIER_SLOVENIAN: Record<string, string> = {
  'left': 'levo',
  'right': 'desno',
  'slight left': 'rahlo levo',
  'slight right': 'rahlo desno',
  'sharp left': 'ostro levo',
  'sharp right': 'ostro desno',
  'straight': 'naravnost',
  'uturn': 'polkrožni obrat',
}

function translateInstruction(type: string, modifier?: string, name?: string): string {
  if (type === 'arrive') return '📍 Prispeli ste na cilj'
  if (type === 'roundabout' || type === 'rotary') {
    return `🔄 Krožišče${name ? ` - ${name}` : ''}`
  }
  const turnWord = TURN_SLOVENIAN[type] || 'Nadaljuj'
  const mod = modifier ? MODIFIER_SLOVENIAN[modifier] || modifier : ''
  const roadName = name && name !== '' ? ` na ${name}` : ''
  if (mod) return `${turnWord} ${mod}${roadName}`
  return `${turnWord}${roadName}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const waypointsParam = searchParams.get('waypoints')
    if (!waypointsParam) return NextResponse.json({ error: 'waypoints required' }, { status: 400 })

    const waypoints = JSON.parse(waypointsParam)
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 waypoints' }, { status: 400 })
    }

    const coords = waypoints.map((w: { lat: number; lng: number }) => `${w.lng},${w.lat}`).join(';')
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&steps=true&geometries=geojson`

    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) })
    if (!osrmRes.ok) return NextResponse.json({ error: 'Routing service unavailable' }, { status: 502 })

    const osrmData = await osrmRes.json()
    if (!osrmData.routes?.length) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    const route = osrmData.routes[0]
    const steps = route.legs.flatMap((leg: any) =>
      leg.steps.map((step: any) => ({
        instruction: translateInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
        type: step.maneuver.type,
        modifier: step.maneuver.modifier || null,
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        name: step.name || '',
        lat: step.maneuver.location[1],
        lng: step.maneuver.location[0],
      }))
    )

    const geometry: [number, number][] = route.geometry.coordinates.map(
      (c: number[]) => [c[1], c[0]] as [number, number]
    )

    return NextResponse.json({
      data: {
        steps,
        totalDistance: Math.round(route.distance),
        totalDuration: Math.round(route.duration),
        geometry,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Navigation failed' }, { status: 500 })
  }
}
