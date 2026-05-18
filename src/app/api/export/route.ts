import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Main export endpoint — routes to format-specific handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    const routeId = searchParams.get('routeId')
    const format = searchParams.get('format') || 'gpx'
    const includeSpeed = searchParams.get('includeSpeed') !== 'false'
    const includeElevation = searchParams.get('includeElevation') !== 'false'
    const includeWaypoints = searchParams.get('includeWaypoints') !== 'false'
    const activityType = searchParams.get('activityType') || 'Biking'

    if (!rideId && !routeId) {
      return NextResponse.json({ error: 'Podajte rideId ali routeId' }, { status: 400 })
    }

    // Fetch data from database
    let title = 'MotoTrack vožnja'
    let exportDate = new Date().toISOString().split('T')[0]
    let distance = 0
    let duration = 0
    let points: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }> = []
    let waypoints: Array<{ lat: number; lng: number; name: string }> = []

    if (rideId) {
      const ride = await db.ride.findUnique({
        where: { id: rideId },
        include: { user: { select: { name: true } } },
      })
      if (!ride) return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
      title = ride.title
      exportDate = ride.createdAt.toISOString().split('T')[0]
      distance = ride.distance
      duration = ride.duration
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track)) {
          points = track.map((p: number[], i: number) => {
            let speed: number | null = null
            if (i > 0) {
              const prevTime = track[i - 1][3]
              const currTime = p[3]
              if (prevTime && currTime && currTime > prevTime) {
                const dt = (currTime - prevTime) / 1000
                if (dt > 0) {
                  const d = haversineDistance(track[i - 1][0], track[i - 1][1], p[0], p[1])
                  speed = (d / dt) * 3.6
                }
              }
            }
            return {
              lat: p[0],
              lng: p[1],
              alt: p[2] ?? null,
              speed,
              timestamp: p[3] || Date.now(),
            }
          })
        }
      } catch { /* ignore parse error */ }
    } else if (routeId) {
      const route = await db.route.findUnique({
        where: { id: routeId },
        include: { user: { select: { name: true } } },
      })
      if (!route) return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      title = route.title
      exportDate = route.createdAt.toISOString().split('T')[0]
      distance = route.distance
      try {
        const wpRaw = JSON.parse(route.waypoints)
        if (Array.isArray(wpRaw)) {
          waypoints = wpRaw.map((w: { lat: number; lng: number; name?: string }, i: number) => ({
            lat: w.lat,
            lng: w.lng,
            name: w.name || `Točka ${i + 1}`,
          }))
        }
      } catch { /* ignore */ }
      try {
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            points = rd.map((p: number[]) => ({
              lat: p[0],
              lng: p[1],
              alt: p[2] ?? null,
              speed: null,
              timestamp: p[3] || Date.now(),
            }))
          }
        } else {
          points = waypoints.map(w => ({
            lat: w.lat,
            lng: w.lng,
            alt: null,
            speed: null,
            timestamp: Date.now(),
          }))
        }
      } catch { /* ignore */ }
    }

    // Generate the requested format
    switch (format) {
      case 'tcx': {
        const tcx = generateTCX(points, title, exportDate, distance, duration, activityType, includeSpeed, includeElevation)
        return new NextResponse(tcx, {
          headers: {
            'Content-Type': 'application/vnd.garmin.tcx+xml',
            'Content-Disposition': `attachment; filename="MotoTrack_voznja_${exportDate}.tcx"`,
          },
        })
      }
      case 'kml': {
        const kml = generateKML(points, waypoints, title, includeWaypoints, includeElevation)
        return new NextResponse(kml, {
          headers: {
            'Content-Type': 'application/vnd.google-earth.kml+xml',
            'Content-Disposition': `attachment; filename="MotoTrack_voznja_${exportDate}.kml"`,
          },
        })
      }
      case 'csv': {
        const csv = generateCSV(points, includeSpeed, includeElevation)
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="MotoTrack_voznja_${exportDate}.csv"`,
          },
        })
      }
      case 'gpx':
      default: {
        const gpxUrl = rideId
          ? `/api/gpx/export?rideId=${rideId}`
          : `/api/gpx/export?routeId=${routeId}`
        return NextResponse.redirect(new URL(gpxUrl, request.url))
      }
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Napaka pri izvozu' }, { status: 500 })
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function generateTCX(
  points: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }>,
  title: string,
  exportDate: string,
  distance: number,
  duration: number,
  activityType: string,
  includeSpeed: boolean,
  includeElevation: boolean,
): string {
  const startTime = points.length > 0 ? new Date(points[0].timestamp).toISOString() : `${exportDate}T10:00:00Z`

  const lapDistance = 5000
  let cumulativeDistance = 0
  let lapStartIdx = 0
  const laps: Array<{ startIndex: number; endIndex: number; startTime: string; totalDistance: number }> = []

  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
    cumulativeDistance += d
    if (cumulativeDistance >= lapDistance || i === points.length - 1) {
      laps.push({
        startIndex: lapStartIdx,
        endIndex: i,
        startTime: new Date(points[lapStartIdx].timestamp).toISOString(),
        totalDistance: cumulativeDistance,
      })
      lapStartIdx = i
      cumulativeDistance = 0
    }
  }

  if (laps.length === 0 && points.length > 0) {
    laps.push({
      startIndex: 0,
      endIndex: points.length - 1,
      startTime,
      totalDistance: distance * 1000,
    })
  }

  const lapXml = laps.map(lap => {
    const trackpoints = points.slice(lap.startIndex, lap.endIndex + 1).map((p, idx) => {
      let distFromLapStart = 0
      for (let j = lap.startIndex; j < lap.startIndex + idx; j++) {
        if (j < points.length - 1) {
          distFromLapStart += haversineDistance(points[j].lat, points[j].lng, points[j + 1].lat, points[j + 1].lng)
        }
      }

      let tp = `          <Trackpoint>
            <Time>${new Date(p.timestamp).toISOString()}</Time>
            <Position>
              <LatitudeDegrees>${p.lat.toFixed(7)}</LatitudeDegrees>
              <LongitudeDegrees>${p.lng.toFixed(7)}</LongitudeDegrees>
            </Position>`

      if (includeElevation && p.alt !== null) {
        tp += `\n            <AltitudeMeters>${p.alt.toFixed(1)}</AltitudeMeters>`
      }

      tp += `\n            <DistanceMeters>${distFromLapStart.toFixed(1)}</DistanceMeters>`

      if (includeSpeed && p.speed !== null) {
        const speedMs = p.speed / 3.6
        tp += `\n            <Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Speed>${speedMs.toFixed(2)}</Speed></TPX></Extensions>`
      }

      tp += `\n          </Trackpoint>`
      return tp
    }).join('\n')

    const lapDuration = ((points[lap.endIndex]?.timestamp ?? points[lap.startIndex]?.timestamp ?? Date.now()) - (points[lap.startIndex]?.timestamp ?? Date.now())) / 1000

    return `      <Lap StartTime="${lap.startTime}">
        <TotalTimeSeconds>${Math.max(1, lapDuration)}</TotalTimeSeconds>
        <DistanceMeters>${lap.totalDistance.toFixed(1)}</DistanceMeters>
        <Calories>0</Calories>
        <Track>
${trackpoints}
        </Track>
      </Lap>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${escapeXml(activityType)}">
      <Id>${startTime}</Id>
${lapXml}
    </Activity>
  </Activities>
  <Author xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Application_t">
    <Name>MotoTrack</Name>
    <Build>
      <Version>
        <VersionMajor>2</VersionMajor>
        <VersionMinor>0</VersionMinor>
      </Version>
    </Build>
    <LangID>sl</LangID>
    <PartNumber>000-00000-00</PartNumber>
  </Author>
</TrainingCenterDatabase>`
}

function generateKML(
  points: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }>,
  waypoints: Array<{ lat: number; lng: number; name: string }>,
  title: string,
  includeWaypoints: boolean,
  includeElevation: boolean,
): string {
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

  return `<?xml version="1.0" encoding="UTF-8"?>
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
    <Style id="startStyle">
      <IconStyle><color>ff00ff00</color><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png</href></Icon></IconStyle>
    </Style>
    <Style id="endStyle">
      <IconStyle><color>ff0000ff</color><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href></Icon></IconStyle>
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
}

function generateCSV(
  points: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }>,
  includeSpeed: boolean,
  includeElevation: boolean,
): string {
  const sep = ';'
  const headers = ['timestamp', 'latitude', 'longitude']
  if (includeElevation) headers.push('altitude_m')
  if (includeSpeed) headers.push('speed_kmh')

  const rows = points.map((p) => {
    const row = [
      new Date(p.timestamp).toISOString(),
      p.lat.toFixed(7),
      p.lng.toFixed(7),
    ]
    if (includeElevation) row.push(p.alt !== null ? p.alt.toFixed(1) : '')
    if (includeSpeed) row.push(p.speed !== null ? p.speed.toFixed(1) : '')
    return row.join(sep)
  })

  return '\uFEFF' + headers.join(sep) + '\n' + rows.join('\n')
}
