import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')
    const includeWaypoints = searchParams.get('includeWaypoints') !== 'false'
    const includeElevation = searchParams.get('includeElevation') !== 'false'

    if (!rideId && !routeId) {
      return NextResponse.json({ error: 'Podajte rideId ali routeId' }, { status: 400 })
    }

    let title = 'MotoTrack vožnja'
    let exportDate = new Date().toISOString().split('T')[0]
    let points: Array<{ lat: number; lng: number; alt: number | null }> = []
    let waypoints: Array<{ lat: number; lng: number; name: string }> = []

    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } })
      if (!ride) return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
      title = ride.title
      exportDate = ride.createdAt.toISOString().split('T')[0]
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track)) {
          points = track.map((p: number[]) => ({ lat: p[0], lng: p[1], alt: p[2] ?? null }))
        }
      } catch { /* ignore */ }
    } else if (routeId) {
      const route = await db.route.findUnique({ where: { id: routeId } })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      title = route.title
      exportDate = route.createdAt.toISOString().split('T')[0]
      try {
        const wpRaw = JSON.parse(route.waypoints)
        if (Array.isArray(wpRaw)) {
          waypoints = wpRaw.map((w: { lat: number; lng: number; name?: string }, i: number) => ({
            lat: w.lat, lng: w.lng, name: w.name || `Točka ${i + 1}`,
          }))
        }
      } catch { /* ignore */ }
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            points = rd.map((p: number[]) => ({ lat: p[0], lng: p[1], alt: p[2] ?? null }))
          }
        } else {
          points = waypoints.map(w => ({ lat: w.lat, lng: w.lng, alt: null }))
        }
      } catch { /* ignore */ }
    }

    const coords = points.map(p =>
      `${p.lng.toFixed(7)},${p.lat.toFixed(7)},${includeElevation && p.alt !== null ? p.alt.toFixed(1) : '0'}`
    ).join(' ')

    const waypointPlacemarks = includeWaypoints ? waypoints.map((w, i) => {
      const color = i === 0 ? 'ff00ff00' : i === waypoints.length - 1 ? 'ff0000ff' : 'ff00ffff'
      return `    <Placemark>
      <name>${escapeXml(w.name)}</name>
      <Style><IconStyle><color>${color}</color><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href></Icon></IconStyle></Style>
      <Point><coordinates>${w.lng.toFixed(7)},${w.lat.toFixed(7)},0</coordinates></Point>
    </Placemark>`
    }).join('\n') : ''

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>MotoTrack - ${escapeXml(title)}</name>
    <description>Izvoz iz MotoTrack — ${escapeXml(title)}</description>
    <Style id="trackStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Sled</name>
      <styleUrl>#trackStyle</styleUrl>
      <LineString>
        <altitudeMode>${includeElevation ? 'absolute' : 'clampToGround'}</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
${waypointPlacemarks}
  </Document>
</kml>`

    return new NextResponse(kml, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Content-Disposition': `attachment; filename="MotoTrack_${exportDate}.kml"`,
      },
    })
  } catch (error) {
    console.error('KML export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu KML' }, { status: 500 })
  }
}
