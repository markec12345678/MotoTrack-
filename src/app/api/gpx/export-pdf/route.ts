import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

// Helper: fetch elevations from Open-Meteo API
async function getElevations(points: Array<{ lat: number; lng: number }>): Promise<(number | null)[]> {
  try {
    // Open-Meteo allows up to 100 points per request
    const sampled = points.length > 80
      ? points.filter((_, i) => i % Math.ceil(points.length / 80) === 0 || i === points.length - 1)
      : points

    const latStr = sampled.map(p => p.lat.toFixed(5)).join(',')
    const lngStr = sampled.map(p => p.lng.toFixed(5)).join(',')

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) return points.map(() => null)

    const data = await res.json()
    const elevations: (number | null)[] = data.elevation || []

    // Map back to original points
    if (sampled.length === points.length) return elevations

    // Interpolate for non-sampled points
    return points.map((_, idx) => {
      const sampleIdx = Math.round(idx * (sampled.length - 1) / Math.max(1, points.length - 1))
      return elevations[sampleIdx] ?? null
    })
  } catch {
    return points.map(() => null)
  }
}

// Helper: haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Fetch turn-by-turn navigation steps from internal API
async function fetchNavigationSteps(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<Array<{ instruction: string; distance: number; type: string }>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/navigation?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}&maxWaypoints=25`,
      { signal: AbortSignal.timeout(12000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.data?.steps || []).map((s: any) => ({
      instruction: s.instruction || '',
      distance: s.distance || 0,
      type: s.type || '',
    }))
  } catch {
    return []
  }
}

// Add page number footer to current page
function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, routeTitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Footer line
  doc.setDrawColor(249, 115, 22)
  doc.setLineWidth(0.5)
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15)

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`MotoTrack · ${new Date().toLocaleDateString('sl-SI')} · mototrack.app`, 20, pageHeight - 10)
  doc.text(`Stran ${pageNum} / ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' })
  doc.text(routeTitle, pageWidth / 2, pageHeight - 10, { align: 'center' })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')
    const rideId = searchParams.get('rideId')

    if (!routeId && !rideId) {
      return NextResponse.json({ error: 'Manjka routeId ali rideId' }, { status: 400 })
    }

    // Fetch data based on what was requested
    let waypoints: Array<{ lat: number; lng: number }> = []
    let title = ''
    let description = ''
    let distanceVal = 0
    let category = 'scenic'
    let difficulty = 'medium'
    let authorName = 'Neznan'
    let createdAt = ''
    let isRide = false
    let trackPoints: Array<{ lat: number; lng: number; alt: number | null }> = []
    let rideElevation = 0

    if (rideId) {
      // Ride export
      const ride = await db.ride.findUnique({ where: { id: rideId }, include: { user: true } })
      if (!ride) {
        return NextResponse.json({ error: 'Voznja ni najdena' }, { status: 404 })
      }
      isRide = true
      title = ride.title
      description = ride.description || ''
      distanceVal = ride.distance
      category = 'ride'
      authorName = ride.user?.name || 'Neznan'
      createdAt = ride.createdAt.toISOString()
      rideElevation = ride.elevation

      // Parse track data
      try {
        const td = JSON.parse(ride.trackData)
        if (Array.isArray(td)) {
          trackPoints = td.map((p: number[]) => ({
            lat: p[0],
            lng: p[1],
            alt: p.length > 2 ? p[2] : null,
          }))
          // Derive waypoints from track points (sample every Nth point)
          const sampleRate = Math.max(1, Math.floor(trackPoints.length / 25))
          waypoints = trackPoints
            .filter((_, i) => i % sampleRate === 0 || i === trackPoints.length - 1)
            .map(p => ({ lat: p.lat, lng: p.lng }))
        }
      } catch { /* ignore */ }
    } else if (routeId) {
      // Route export
      const route = await db.route.findUnique({ where: { id: routeId }, include: { user: true } })
      if (!route) {
        return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
      }
      title = route.title
      description = route.description || ''
      distanceVal = route.distance
      category = route.category
      difficulty = route.difficulty
      authorName = route.user?.name || 'Neznan'
      createdAt = route.createdAt.toISOString()

      try { waypoints = JSON.parse(route.waypoints) } catch { /* ignore */ }

      // Try to get track data from routeData for elevation
      if (route.routeData) {
        try {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd)) {
            trackPoints = rd.map((p: number[]) => ({
              lat: p[0],
              lng: p.length > 1 ? p[1] : 0,
              alt: p.length > 2 ? p[2] : null,
            }))
          }
        } catch { /* ignore */ }
      }
    }

    // Get elevation data
    const pointsForElevation = isRide ? trackPoints : waypoints
    let elevations = await getElevations(pointsForElevation)

    // If track points already have elevation, use those
    if (isRide && trackPoints.length > 0 && trackPoints[0].alt !== null && trackPoints[0].alt !== 0) {
      elevations = trackPoints.map(p => p.alt)
    }

    // Calculate gradient statistics
    let totalAscent = 0
    let totalDescent = 0
    let maxGradient = 0
    const gradientSegments: Array<{ gradient: number; distance: number; elevStart: number; elevEnd: number }> = []

    for (let i = 1; i < elevations.length; i++) {
      if (elevations[i] !== null && elevations[i - 1] !== null) {
        const elevDiff = elevations[i]! - elevations[i - 1]!
        const p1 = pointsForElevation[i - 1]
        const p2 = pointsForElevation[i]
        const dist = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng)
        const gradient = dist > 0 ? (elevDiff / dist) * 100 : 0

        if (elevDiff > 0) totalAscent += elevDiff
        else totalDescent += Math.abs(elevDiff)

        maxGradient = Math.max(maxGradient, Math.abs(gradient))
        gradientSegments.push({
          gradient,
          distance: dist,
          elevStart: elevations[i - 1]!,
          elevEnd: elevations[i]!,
        })
      }
    }

    // Gradient distribution
    let steepUphillDist = 0
    let moderateUphillDist = 0
    let flatDist = 0
    let moderateDownhillDist = 0
    let steepDownhillDist = 0

    for (const seg of gradientSegments) {
      if (seg.gradient > 8) steepUphillDist += seg.distance
      else if (seg.gradient > 3) moderateUphillDist += seg.distance
      else if (seg.gradient >= -3) flatDist += seg.distance
      else if (seg.gradient >= -8) moderateDownhillDist += seg.distance
      else steepDownhillDist += seg.distance
    }
    const totalGradientDist = steepUphillDist + moderateUphillDist + flatDist + moderateDownhillDist + steepDownhillDist

    // Fetch navigation steps
    const navSteps = await fetchNavigationSteps(waypoints)

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = 20
    let pageNum = 1

    // We'll track total pages at the end
    // First pass: generate content, then add page numbers

    // ===== PAGE 1: HEADER =====
    // Two-column header with MotoTrack branding
    // Left: MotoTrack logo/branding
    doc.setFontSize(28)
    doc.setTextColor(249, 115, 22)
    doc.text('MotoTrack', 20, y)

    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text('GPS Sledenje Motociklistov', 20, y + 7)

    // Right: route type badge
    const categoryMap: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto', snowmobile: 'Snežni skuter', racetrack: 'Dirkališče', ride: 'Voznja' }
    const difficultyMap: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }

    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text(`Kategorija: ${categoryMap[category] || category}`, pageWidth - 20, y, { align: 'right' })
    doc.text(`Težavnost: ${difficultyMap[difficulty] || difficulty}`, pageWidth - 20, y + 6, { align: 'right' })
    doc.text(`Datum: ${new Date(createdAt).toLocaleDateString('sl-SI')}`, pageWidth - 20, y + 12, { align: 'right' })

    y += 20

    // Orange accent line
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(1.5)
    doc.line(20, y, pageWidth - 20, y)
    y += 10

    // Route/Ride title
    doc.setFontSize(20)
    doc.setTextColor(30, 30, 30)
    doc.text(isRide ? `🏍️ ${title}` : `🗺️ ${title}`, 20, y)
    y += 10

    // Route info in two columns
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    const col1X = 20
    const col2X = pageWidth / 2 + 10

    doc.text(`Razdalja: ${distanceVal.toFixed(1)} km`, col1X, y)
    doc.text(`Avtor: ${authorName}`, col2X, y)
    y += 6
    doc.text(`Skupni vzpon: ${Math.round(totalAscent)} m`, col1X, y)
    doc.text(`Skupni spust: ${Math.round(totalDescent)} m`, col2X, y)
    y += 6
    if (isRide && rideElevation) {
      doc.text(`Višinska razlika: ${Math.round(rideElevation)} m`, col1X, y)
    }
    if (description) {
      doc.text(`Opis: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`, col2X, y)
    }
    y += 10

    // ===== ELEVATION PROFILE =====
    if (y > 180) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Višinski profil', 20, y)
    y += 8

    const chartX = 25
    const chartW = pageWidth - 50
    const chartH = 55
    const chartY = y

    // Draw chart background
    doc.setFillColor(250, 250, 250)
    doc.rect(chartX, chartY, chartW, chartH, 'F')

    // Draw chart border
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.rect(chartX, chartY, chartW, chartH)

    // Draw elevation profile
    const validElevations = elevations.filter(e => e !== null) as number[]
    if (validElevations.length >= 2) {
      const minElev = Math.min(...validElevations)
      const maxElev = Math.max(...validElevations)
      const elevRange = maxElev - minElev || 100

      // Y-axis gridlines and labels
      doc.setFontSize(7)
      doc.setTextColor(130, 130, 130)
      for (let g = 0; g <= 4; g++) {
        const gy = chartY + (g / 4) * chartH
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.2)
        doc.line(chartX, gy, chartX + chartW, gy)
        const elevLabel = Math.round(maxElev - (g / 4) * elevRange)
        doc.text(`${elevLabel}m`, chartX - 2, gy + 2, { align: 'right' })
      }

      // X-axis labels
      doc.text('0 km', chartX, chartY + chartH + 5)
      doc.text(`${distanceVal.toFixed(1)} km`, chartX + chartW, chartY + chartH + 5, { align: 'right' })

      // Draw filled area under the elevation line
      const stepX = chartW / Math.max(1, validElevations.length - 1)

      // Fill area with light orange
      doc.setFillColor(249, 115, 22)
      doc.setDrawColor(249, 115, 22)
      doc.setLineWidth(0.8)

      // Draw the elevation line and fill
      const points: Array<[number, number]> = validElevations.map((elev, i) => {
        const px = chartX + i * stepX
        const py = chartY + chartH - ((elev - minElev) / elevRange) * (chartH - 6) - 3
        return [px, py]
      })

      // Draw filled area
      doc.setFillColor(255, 237, 223) // light orange fill
      doc.setDrawColor(249, 115, 22)

      // Start path from bottom-left
      let pathStr = `${points[0][0].toFixed(2)} ${(chartY + chartH).toFixed(2)} m`
      for (const p of points) {
        pathStr += ` ${p[0].toFixed(2)} ${p[1].toFixed(2)} l`
      }
      pathStr += ` ${points[points.length - 1][0].toFixed(2)} ${(chartY + chartH).toFixed(2)} l h`

      // Use simple line drawing instead
      // Draw filled polygon using lines
      doc.setFillColor(255, 237, 223)
      doc.triangle(
        points[0][0], chartY + chartH,
        points[0][0], points[0][1],
        points[points.length - 1][0], chartY + chartH,
        'F'
      )

      // Draw the elevation line
      doc.setDrawColor(249, 115, 22)
      doc.setLineWidth(1.2)
      for (let i = 1; i < points.length; i++) {
        doc.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
      }

      // Start/End markers
      if (points.length > 0) {
        doc.setFillColor(34, 197, 94)
        doc.circle(points[0][0], points[0][1], 2.5, 'F')
        doc.setFillColor(239, 68, 68)
        doc.circle(points[points.length - 1][0], points[points.length - 1][1], 2.5, 'F')
      }
    } else {
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 150)
      doc.text('Podatki o nadmorski višini niso na voljo', chartX + chartW / 2, chartY + chartH / 2, { align: 'center' })
    }

    y = chartY + chartH + 12

    // ===== GRADIENT SUMMARY =====
    if (y > 230) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Povzetek naklonov', 20, y)
    y += 8

    // Gradient stats in a box
    doc.setFillColor(255, 247, 237) // light orange bg
    doc.roundedRect(20, y - 3, pageWidth - 40, 32, 3, 3, 'F')

    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    const gradientCol1X = 25
    const gradientCol2X = pageWidth / 2

    doc.text(`Skupni vzpon: ${Math.round(totalAscent)} m`, gradientCol1X, y + 4)
    doc.text(`Skupni spust: ${Math.round(totalDescent)} m`, gradientCol2X, y + 4)
    doc.text(`Največji naklon: ${maxGradient.toFixed(1)}%`, gradientCol1X, y + 11)
    doc.text(`Povprečni naklon: ${gradientSegments.length > 0 ? (gradientSegments.reduce((s, g) => s + Math.abs(g.gradient), 0) / gradientSegments.length).toFixed(1) : '0'}%`, gradientCol2X, y + 11)

    // Gradient distribution bar
    if (totalGradientDist > 0) {
      const barX = 25
      const barW = pageWidth - 50
      const barH = 6
      const barY = y + 17

      const steepUpPct = steepUphillDist / totalGradientDist
      const modUpPct = moderateUphillDist / totalGradientDist
      const flatPct = flatDist / totalGradientDist
      const modDownPct = moderateDownhillDist / totalGradientDist
      const steepDownPct = steepDownhillDist / totalGradientDist

      let bx = barX
      // Steep uphill - red
      doc.setFillColor(220, 38, 38)
      doc.rect(bx, barY, barW * steepUpPct, barH, 'F')
      bx += barW * steepUpPct
      // Moderate uphill - orange
      doc.setFillColor(249, 115, 22)
      doc.rect(bx, barY, barW * modUpPct, barH, 'F')
      bx += barW * modUpPct
      // Flat - green
      doc.setFillColor(34, 197, 94)
      doc.rect(bx, barY, barW * flatPct, barH, 'F')
      bx += barW * flatPct
      // Moderate downhill - amber
      doc.setFillColor(245, 158, 11)
      doc.rect(bx, barY, barW * modDownPct, barH, 'F')
      bx += barW * modDownPct
      // Steep downhill - dark red
      doc.setFillColor(185, 28, 28)
      doc.rect(bx, barY, barW * steepDownPct, barH, 'F')

      // Labels under bar
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text(`Strm vzpon >8%: ${Math.round(steepUpPct * 100)}%`, barX, barY + barH + 4)
      doc.text(`Zmeren vzpon 3-8%: ${Math.round(modUpPct * 100)}%`, barX + 40, barY + barH + 4)
      doc.text(`Ravno: ${Math.round(flatPct * 100)}%`, barX + 90, barY + barH + 4)
      doc.text(`Zmeren spust: ${Math.round(modDownPct * 100)}%`, barX + 120, barY + barH + 4)
      doc.text(`Strm spust >8%: ${Math.round(steepDownPct * 100)}%`, barX + 155, barY + barH + 4)
    }

    y += 40

    // ===== WAYPOINTS TABLE =====
    if (y > 230) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text(isRide ? 'Točke vožnje' : 'Točke poti', 20, y)
    y += 8

    // Table header
    doc.setFillColor(249, 115, 22)
    doc.rect(20, y - 5, pageWidth - 40, 8, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('#', 25, y)
    doc.text('Zem. širina', 40, y)
    doc.text('Zem. dolžina', 80, y)
    doc.text('Nadm. višina', 120, y)
    doc.text('Opis', 160, y)
    y += 8

    // Table rows with alternating colors
    doc.setTextColor(50, 50, 50)
    waypoints.forEach((wp, i) => {
      if (y > pageHeight - 30) {
        addPageFooter(doc, pageNum, 0, title)
        doc.addPage()
        pageNum++
        y = 20

        // Repeat table header on new page
        doc.setFillColor(249, 115, 22)
        doc.rect(20, y - 5, pageWidth - 40, 8, 'F')
        doc.setFontSize(9)
        doc.setTextColor(255, 255, 255)
        doc.text('#', 25, y)
        doc.text('Zem. širina', 40, y)
        doc.text('Zem. dolžina', 80, y)
        doc.text('Nadm. višina', 120, y)
        doc.text('Opis', 160, y)
        y += 8
      }
      // Alternating row colors
      const bgColor = i % 2 === 0 ? 248 : 255
      doc.setFillColor(bgColor, bgColor, bgColor)
      doc.rect(20, y - 5, pageWidth - 40, 7, 'F')

      doc.setFontSize(8)
      doc.setTextColor(50, 50, 50)
      doc.text(`${i + 1}`, 25, y)
      doc.text(wp.lat.toFixed(6), 40, y)
      doc.text(wp.lng.toFixed(6), 80, y)

      // Elevation for this point
      const pointIdx = isRide
        ? Math.min(i, elevations.length - 1)
        : Math.min(i, elevations.length - 1)
      const elev = elevations[pointIdx]
      doc.text(elev !== null ? `${Math.round(elev)} m` : '—', 120, y)

      const label = i === 0 ? 'START' : i === waypoints.length - 1 ? 'CILJ' : `Točka ${i + 1}`
      doc.text(label, 160, y)
      y += 7
    })

    y += 8

    // ===== TURN-BY-TURN INSTRUCTIONS =====
    if (navSteps.length > 0) {
      if (y > pageHeight - 60) { doc.addPage(); pageNum++; y = 20 }

      doc.setFontSize(13)
      doc.setTextColor(30, 30, 30)
      doc.text('Navodila po korakih', 20, y)
      y += 8

      // Table header
      doc.setFillColor(249, 115, 22)
      doc.rect(20, y - 5, pageWidth - 40, 7, 'F')
      doc.setFontSize(8)
      doc.setTextColor(255, 255, 255)
      doc.text('#', 25, y)
      doc.text('Navodilo', 35, y)
      doc.text('Razdalja', pageWidth - 45, y)
      y += 7

      navSteps.forEach((step, i) => {
        if (y > pageHeight - 30) {
          addPageFooter(doc, pageNum, 0, title)
          doc.addPage()
          pageNum++
          y = 20
        }
        const bgColor = i % 2 === 0 ? 248 : 255
        doc.setFillColor(bgColor, bgColor, bgColor)
        doc.rect(20, y - 5, pageWidth - 40, 6, 'F')

        doc.setFontSize(7)
        doc.setTextColor(50, 50, 50)
        doc.text(`${i + 1}`, 25, y)

        // Truncate instruction if too long
        const instr = step.instruction.length > 60 ? step.instruction.substring(0, 57) + '...' : step.instruction
        doc.text(instr, 35, y)
        doc.text(`${(step.distance / 1000).toFixed(1)} km`, pageWidth - 45, y)
        y += 6
      })
      y += 8
    }

    // ===== QR CODE PLACEHOLDER =====
    if (y > pageHeight - 60) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text('Povezava do poti', 20, y)
    y += 8

    // QR-code-like box
    const entityId = routeId || rideId || ''
    const qrUrl = `mototrack.app/${isRide ? 'ride' : 'route'}/${entityId.substring(0, 12)}`

    const qrBoxSize = 25
    const qrX = 20
    const qrY = y

    // Draw QR placeholder box
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(1)
    doc.rect(qrX, qrY, qrBoxSize, qrBoxSize)

    // Draw fake QR pattern (decorative)
    doc.setFillColor(30, 30, 30)
    const cellSize = qrBoxSize / 9
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        // Create a pseudo-QR pattern
        const isFilled = ((r + c) % 3 === 0) || (r < 3 && c < 3) || (r < 3 && c >= 6) || (r >= 6 && c < 3)
        if (isFilled) {
          doc.rect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize, 'F')
        }
      }
    }

    // URL text next to QR box
    doc.setFontSize(9)
    doc.setTextColor(249, 115, 22)
    doc.text('Skenirajte za ogled poti', qrX + qrBoxSize + 8, qrY + 8)
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(qrUrl, qrX + qrBoxSize + 8, qrY + 15)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Odprite v aplikaciji MotoTrack', qrX + qrBoxSize + 8, qrY + 22)

    y = qrY + qrBoxSize + 12

    // ===== MOTORCYCLE SAFETY TIPS =====
    if (y > pageHeight - 80) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(11)
    doc.setTextColor(249, 115, 22)
    doc.text('🏍️ Varnostni nasveti za motoriste', 20, y)
    y += 7

    doc.setFillColor(255, 247, 237)
    const safetyTips = [
      'Vedno nosite zaščitno opremo (čelada, jakna, hlače, škornji, rokavice).',
      'Prilagodite hitrost razmeram na cesti in vremenu.',
      'Vedno imejte poln rezervoar goriva pred daljšo vožnjo.',
      'Preverite vremensko napoved pred odhodom na pot.',
      'Na ozkih in vijugastih cestah vozite v mejah svojih zmožnosti.',
      'Redno preverjajte tlak v pnevmatikah in stanje zavor.',
      'Ohranjajte varnostno razdaljo do vozil pred vami.',
      'Na terenskih cestah bodite pozorni na prod, pesek in druge ovire.',
      'Vedno imejte pri sebi mobilni telefon in telefone za nujne primere.',
      'Spoštujte prometne predpise in omejitve hitrosti.',
    ]

    const tipsBoxH = safetyTips.length * 5 + 8
    doc.roundedRect(20, y - 3, pageWidth - 40, tipsBoxH, 3, 3, 'F')

    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    safetyTips.forEach((tip, i) => {
      doc.text(`• ${tip}`, 25, y + 3 + i * 5)
    })

    y += tipsBoxH + 5

    // Route sketch visualization
    if (y > pageHeight - 60) { doc.addPage(); pageNum++; y = 20 }

    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Skica poti', 20, y)
    y += 8

    const sketchX = 30
    const sketchW = pageWidth - 60
    const sketchH = 45

    // Draw bounding box
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.rect(sketchX, y, sketchW, sketchH)

    // Draw route line
    if (waypoints.length >= 2) {
      const minLat = Math.min(...waypoints.map(w => w.lat))
      const maxLat = Math.max(...waypoints.map(w => w.lat))
      const minLng = Math.min(...waypoints.map(w => w.lng))
      const maxLng = Math.max(...waypoints.map(w => w.lng))
      const latRange = maxLat - minLat || 0.01
      const lngRange = maxLng - minLng || 0.01

      doc.setDrawColor(249, 115, 22)
      doc.setLineWidth(1.5)
      waypoints.forEach((wp, i) => {
        const px = sketchX + 5 + ((wp.lng - minLng) / lngRange) * (sketchW - 10)
        const py = y + 5 + ((maxLat - wp.lat) / latRange) * (sketchH - 10)
        if (i === 0) {
          doc.setFillColor(34, 197, 94)
          doc.circle(px, py, 3, 'F')
          doc.setDrawColor(249, 115, 22)
        } else {
          const prev = waypoints[i - 1]
          const prevPx = sketchX + 5 + ((prev.lng - minLng) / lngRange) * (sketchW - 10)
          const prevPy = y + 5 + ((maxLat - prev.lat) / latRange) * (sketchH - 10)
          doc.line(prevPx, prevPy, px, py)
        }
        if (i === waypoints.length - 1) {
          doc.setFillColor(239, 68, 68)
          doc.circle(px, py, 3, 'F')
        }
      })
    }

    y += sketchH + 8

    // Now go back and add page numbers to all pages
    const totalPages = pageNum
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      addPageFooter(doc, p, totalPages, title)
    }

    // Return PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const filename = `mototrack-${(title || 'export').replace(/\s+/g, '-').toLowerCase()}.pdf`
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'Napaka pri izdelavi PDF' }, { status: 500 })
  }
}
