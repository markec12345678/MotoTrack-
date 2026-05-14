import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')

    let title = 'MotoTrack Export'
    let points: Array<{ lat: number; lng: number; alt?: number; time?: number }> = []

    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } })
      if (!ride) return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
      title = ride.title
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
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      title = route.title
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            points = rd.map((p: number[]) => ({ lat: p[0], lng: p[1] }))
          }
        } else {
          const wp = JSON.parse(route.waypoints)
          if (Array.isArray(wp)) {
            points = wp.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng }))
          }
        }
      } catch { /* ignore */ }
    } else {
      return NextResponse.json({ error: 'Podajte rideId ali routeId' }, { status: 400 })
    }

    // Generate GPX XML
    const now = new Date().toISOString()
    const trkpts = points.map(p => {
      let xml = `      <trkpt lat="${p.lat}" lon="${p.lng}">`
      if (p.alt !== undefined && p.alt !== null) {
        xml += `\n        <ele>${p.alt}</ele>`
      }
      if (p.time) {
        xml += `\n        <time>${new Date(p.time).toISOString()}</time>`
      }
      xml += `\n      </trkpt>`
      return xml
    }).join('\n')

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoTrack"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(title)}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escapeXml(title)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`

    return new NextResponse(gpx, {
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.gpx"`,
      },
    })
  } catch (error) {
    console.error('GPX export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu GPX' }, { status: 500 })
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
