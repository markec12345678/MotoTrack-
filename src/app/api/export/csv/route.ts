import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')
    const includeSpeed = searchParams.get('includeSpeed') !== 'false'
    const includeElevation = searchParams.get('includeElevation') !== 'false'

    if (!rideId && !routeId) {
      return NextResponse.json({ error: 'Podajte rideId ali routeId' }, { status: 400 })
    }

    let title = 'MotoTrack vožnja'
    let points: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }> = []

    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } })
      if (!ride) return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
      title = ride.title
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track)) {
          points = track.map((p: number[], i: number) => {
            let speed: number | null = null
            if (i > 0) {
              const R = 6371000
              const dLat = (p[0] - track[i - 1][0]) * Math.PI / 180
              const dLng = (p[1] - track[i - 1][1]) * Math.PI / 180
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(track[i - 1][0] * Math.PI / 180) * Math.cos(p[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2
              const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
              const dt = ((p[3] || 0) - (track[i - 1][3] || 0)) / 1000
              if (dt > 0) speed = (d / dt) * 3.6
            }
            return { lat: p[0], lng: p[1], alt: p[2] ?? null, speed, timestamp: p[3] || Date.now() }
          })
        }
      } catch { /* ignore */ }
    } else if (routeId) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      title = route.title
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            points = rd.map((p: number[]) => ({ lat: p[0], lng: p[1], alt: p[2] ?? null, speed: null, timestamp: p[3] || Date.now() }))
          }
        }
      } catch { /* ignore */ }
    }

    const sep = ';'
    const headers = ['timestamp', 'latitude', 'longitude']
    if (includeElevation) headers.push('altitude_m')
    if (includeSpeed) headers.push('speed_kmh')

    const rows = points.map((p) => {
      const row = [new Date(p.timestamp).toISOString(), p.lat.toFixed(7), p.lng.toFixed(7)]
      if (includeElevation) row.push(p.alt !== null ? p.alt.toFixed(1) : '')
      if (includeSpeed) row.push(p.speed !== null ? p.speed.toFixed(1) : '')
      return row.join(sep)
    })

    const csv = '\uFEFF' + headers.join(sep) + '\n' + rows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="MotoTrack_${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu CSV' }, { status: 500 })
  }
}
