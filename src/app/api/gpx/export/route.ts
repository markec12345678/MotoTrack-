import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function formatIsoTime(ts: number | undefined): string {
  if (!ts) return new Date().toISOString()
  return new Date(ts).toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')

    let title = 'MotoTrack Export'
    let description = ''
    let points: Array<{ lat: number; lng: number; alt?: number | null; time?: number | null }> = []
    let waypoints: Array<{ lat: number; lng: number; name?: string; symbol?: string }> = []
    let exportType: 'ride' | 'route' = 'ride'
    let category = ''
    let difficulty = ''
    let distance = 0
    let duration = 0
    let maxSpeed = 0
    let avgSpeed = 0
    let author = ''
    let shareCode = ''

    if (rideId) {
      const ride = await db.ride.findUnique({
        where: { id: rideId },
        include: { user: { select: { name: true } } },
      })
      if (!ride) return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
      title = ride.title
      description = ride.description || ''
      exportType = 'ride'
      distance = ride.distance
      duration = ride.duration
      maxSpeed = ride.maxSpeed
      avgSpeed = ride.avgSpeed
      author = ride.user?.name || ''
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track)) {
          points = track.map((p: number[]) => ({
            lat: p[0],
            lng: p[1],
            alt: p[2],
            time: p[3],
          }))
        }
      } catch { /* ignore */ }
    } else if (routeId) {
      const route = await db.route.findUnique({
        where: { id: routeId },
        select: {
          title: true,
          description: true,
          distance: true,
          category: true,
          difficulty: true,
          waypoints: true,
          routeData: true,
          shareCode: true,
          user: { select: { name: true } },
        },
      })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      title = route.title
      description = route.description || ''
      exportType = 'route'
      category = route.category || ''
      difficulty = route.difficulty || ''
      distance = route.distance
      author = route.user?.name || ''
      shareCode = route.shareCode || ''
      try {
        // Parse waypoints for wpt elements
        const wpRaw = JSON.parse(route.waypoints)
        if (Array.isArray(wpRaw)) {
          waypoints = wpRaw.map((w: { lat: number; lng: number; name?: string }, i: number) => ({
            lat: w.lat,
            lng: w.lng,
            name: w.name || `Waypoint ${i + 1}`,
            symbol: i === 0 ? 'Flag, Green' : i === wpRaw.length - 1 ? 'Flag, Red' : 'Flag, Blue',
          }))
        }
      } catch { /* ignore */ }
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            points = rd.map((p: number[]) => ({ lat: p[0], lng: p[1] }))
          }
        } else {
          // No route data — use waypoints as route points
          points = waypoints.map(w => ({ lat: w.lat, lng: w.lng }))
        }
      } catch { /* ignore */ }
    } else {
      return NextResponse.json({ error: 'Podajte rideId ali routeId' }, { status: 400 })
    }

    // Generate GPX XML
    const now = new Date().toISOString()

    // Track points (trkpt) — the actual GPS track
    const trkpts = points.map(p => {
      let xml = `      <trkpt lat="${p.lat}" lon="${p.lng}">`
      if (p.alt !== undefined && p.alt !== null) {
        xml += `\n        <ele>${Math.round(p.alt)}</ele>`
      }
      if (p.time) {
        xml += `\n        <time>${formatIsoTime(p.time)}</time>`
      }
      xml += `\n      </trkpt>`
      return xml
    }).join('\n')

    // Waypoints (wpt) — for routes, show the planning waypoints
    const wpts = waypoints.map(w => {
      let xml = `  <wpt lat="${w.lat}" lon="${w.lng}">`
      if (w.name) {
        xml += `\n    <name>${escapeXml(w.name)}</name>`
      }
      if (w.symbol) {
        xml += `\n    <sym>${escapeXml(w.symbol)}</sym>`
      }
      xml += `\n  </wpt>`
      return xml
    }).join('\n')

    // Route points (rtept) — for routes, also create a route element
    const rtepts = waypoints.map((w, i) => {
      let xml = `    <rtept lat="${w.lat}" lon="${w.lng}">`
      xml += `\n      <name>${escapeXml(w.name || `Točka ${i + 1}`)}</name>`
      if (w.symbol) {
        xml += `\n      <sym>${escapeXml(w.symbol)}</sym>`
      }
      xml += `\n    </rtept>`
      return xml
    }).join('\n')

    // Build metadata extensions for MotoTrack-specific data
    let metadataExtensions = ''
    if (exportType === 'ride') {
      metadataExtensions = `
    <mt:type>ride</mt:type>
    <mt:distance>${distance}</mt:distance>
    <mt:duration>${duration}</mt:duration>
    <mt:maxSpeed>${maxSpeed}</mt:maxSpeed>
    <mt:avgSpeed>${avgSpeed}</avgSpeed>
    <mt:pointCount>${points.length}</mt:pointCount>`
    } else {
      metadataExtensions = `
    <mt:type>route</mt:type>
    <mt:category>${escapeXml(category)}</mt:category>
    <mt:difficulty>${escapeXml(difficulty)}</mt:difficulty>
    <mt:distance>${distance}</mt:distance>
    <mt:waypointCount>${waypoints.length}</mt:waypointCount>${shareCode ? `
    <mt:shareCode>${escapeXml(shareCode)}</mt:shareCode>` : ''}`
    }

    // Build the complete GPX document
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoTrack v2 - https://mototrack-gamma.vercel.app"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:mt="https://mototrack-gamma.vercel.app/gpx/extensions"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(title)}</name>${description ? `\n    <desc>${escapeXml(description)}</desc>` : ''}
    <time>${now}</time>${author ? `\n    <author>${escapeXml(author)}</author>` : ''}
    <extensions>${metadataExtensions}
    </extensions>
  </metadata>
${wpts}${waypoints.length > 0 ? '\n' : ''}
  <trk>
    <name>${escapeXml(title)}</name>${description ? `\n    <desc>${escapeXml(description)}</desc>` : ''}
    <type>${exportType === 'ride' ? 'Ride' : escapeXml(category || 'Route')}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>${waypoints.length > 1 ? `
  <rte>
    <name>${escapeXml(title)} - Route</name>
${rtepts}
  </rte>` : ''}
</gpx>`

    return new NextResponse(gpx, {
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9čšžČŠŽ]/g, '_')}.gpx"`,
      },
    })
  } catch (error) {
    console.error('GPX export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu GPX' }, { status: 500 })
  }
}
