import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')

    if (!routeId) {
      return NextResponse.json({ error: 'Manjka routeId' }, { status: 400 })
    }

    const route = await db.route.findUnique({ where: { id: routeId }, include: { user: true } })
    if (!route) {
      return NextResponse.json({ error: 'Pot ni najdena' }, { status: 404 })
    }

    // Parse waypoints
    let waypoints: Array<{ lat: number; lng: number }> = []
    try { waypoints = JSON.parse(route.waypoints) } catch { /* ignore */ }

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFontSize(22)
    doc.setTextColor(249, 115, 22) // orange
    doc.text('MotoTrack', 20, y)
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text('GPS Sledenje', 75, y)
    y += 10

    // Orange line
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(1)
    doc.line(20, y, pageWidth - 20, y)
    y += 15

    // Route title
    doc.setFontSize(18)
    doc.setTextColor(30, 30, 30)
    doc.text(route.title, 20, y)
    y += 12

    // Route info
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)

    const categoryMap: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto', snowmobile: 'Snežni skuter', racetrack: 'Dirkališče' }
    const difficultyMap: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }

    doc.text(`Razdalja: ${route.distance.toFixed(1)} km`, 20, y); y += 7
    doc.text(`Kategorija: ${categoryMap[route.category] || route.category}`, 20, y); y += 7
    doc.text(`Težavnost: ${difficultyMap[route.difficulty] || route.difficulty}`, 20, y); y += 7
    doc.text(`Avtor: ${route.user?.name || 'Neznan'}`, 20, y); y += 7
    doc.text(`Datum: ${new Date(route.createdAt).toLocaleDateString('sl-SI')}`, 20, y); y += 7
    if (route.description) {
      doc.text(`Opis: ${route.description}`, 20, y); y += 7
    }
    y += 5

    // Waypoints table
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Točke poti', 20, y)
    y += 10

    // Table header
    doc.setFillColor(249, 115, 22)
    doc.rect(20, y - 5, pageWidth - 40, 8, 'F')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text('#', 25, y)
    doc.text('Zem. širina', 45, y)
    doc.text('Zem. dolžina', 95, y)
    doc.text('Opis', 145, y)
    y += 8

    // Table rows
    doc.setTextColor(50, 50, 50)
    waypoints.forEach((wp, i) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      const bgColor = i % 2 === 0 ? 245 : 255
      doc.setFillColor(bgColor, bgColor, bgColor)
      doc.rect(20, y - 5, pageWidth - 40, 7, 'F')
      doc.setFontSize(9)
      doc.text(`${i + 1}`, 25, y)
      doc.text(wp.lat.toFixed(6), 45, y)
      doc.text(wp.lng.toFixed(6), 95, y)
      const label = i === 0 ? 'START' : i === waypoints.length - 1 ? 'CILJ' : `Točka ${i + 1}`
      doc.text(label, 145, y)
      y += 7
    })

    y += 10

    // Route sketch (simple text representation)
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Skica poti', 20, y)
    y += 10

    // Draw simple route visualization
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(2)
    const sketchX = 30
    const sketchW = pageWidth - 60
    const sketchH = 50

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
          // Start marker
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

    y += sketchH + 10

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Ustvarjeno z MotoTrack · ${new Date().toLocaleDateString('sl-SI')} · mototrack.app`, 20, 285)
    doc.text(`Skupaj točk: ${waypoints.length} · Razdalja: ${route.distance.toFixed(1)} km`, 20, 290)

    // Return PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mototrack-${route.title.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'Napaka pri izdelavi PDF' }, { status: 500 })
  }
}
