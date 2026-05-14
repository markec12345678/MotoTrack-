import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

// GET /api/gpx/export-pdf - Generate PDF for a route
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')

    if (!routeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: routeId' },
        { status: 400 }
      )
    }

    const route = await db.route.findUnique({
      where: { id: routeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!route) {
      return NextResponse.json(
        { success: false, error: 'Route not found' },
        { status: 404 }
      )
    }

    // Parse waypoints
    let waypoints: Array<{ lat: number; lng: number }> = []
    try {
      waypoints = JSON.parse(route.waypoints)
    } catch {
      waypoints = []
    }

    // Create PDF document
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = 20

    // Header - MotoTrack branding
    doc.setFillColor(30, 30, 30)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('MotoTrack', margin, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Route Details PDF Export', margin, 28)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 28, { align: 'right' })

    y = 45

    // Route Title
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(route.title, margin, y)
    y += 10

    // Description
    if (route.description) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const descLines = doc.splitTextToSize(route.description, contentWidth)
      doc.text(descLines, margin, y)
      y += descLines.length * 5 + 5
    }

    // Divider
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Route Stats
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Route Statistics', margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    const statsData = [
      ['Distance', route.distance > 0 ? `${route.distance.toFixed(1)} km` : 'Not recorded'],
      ['Category', route.category.charAt(0).toUpperCase() + route.category.slice(1)],
      ['Difficulty', route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1)],
      ['Likes', String(route.likes)],
      ['Created by', route.user.name],
      ['Created at', new Date(route.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Visibility', route.isPublic ? 'Public' : 'Private'],
    ]

    statsData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 60, 60)
      doc.text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(value, margin + 40, y)
      y += 6
    })

    y += 5

    // Divider
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Waypoint list
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Waypoints', margin, y)
    y += 8

    if (waypoints.length > 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text('#', margin, y)
      doc.text('Latitude', margin + 12, y)
      doc.text('Longitude', margin + 55, y)
      y += 5

      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, pageWidth - margin, y)
      y += 4

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)

      const maxWaypoints = Math.min(waypoints.length, 50) // Limit to 50 waypoints
      for (let i = 0; i < maxWaypoints; i++) {
        if (y > 270) {
          doc.addPage()
          y = 20
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 100, 100)
          doc.text('#', margin, y)
          doc.text('Latitude', margin + 12, y)
          doc.text('Longitude', margin + 55, y)
          y += 5
          doc.setDrawColor(220, 220, 220)
          doc.line(margin, y, pageWidth - margin, y)
          y += 4
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
        }

        const wp = waypoints[i]
        doc.text(String(i + 1), margin, y)
        doc.text(wp.lat.toFixed(6), margin + 12, y)
        doc.text(wp.lng.toFixed(6), margin + 55, y)
        y += 5
      }

      if (waypoints.length > maxWaypoints) {
        doc.setTextColor(150, 150, 150)
        doc.text(`... and ${waypoints.length - maxWaypoints} more waypoints`, margin, y)
        y += 8
      }
    } else {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      doc.text('No waypoints recorded', margin, y)
      y += 8
    }

    // Check if we need a new page for the map sketch and QR
    if (y > 200) {
      doc.addPage()
      y = 20
    } else {
      y += 5
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8
    }

    // Route Map Sketch (text representation)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Route Map Sketch', margin, y)
    y += 8

    if (waypoints.length >= 2) {
      // Simple text-based map representation
      doc.setFillColor(240, 240, 240)
      doc.roundedRect(margin, y, contentWidth, 50, 3, 3, 'F')

      doc.setFontSize(8)
      doc.setFont('courier', 'normal')
      doc.setTextColor(60, 60, 60)

      // Find bounding box
      const lats = waypoints.map((w) => w.lat)
      const lngs = waypoints.map((w) => w.lng)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      const latRange = maxLat - minLat || 0.01
      const lngRange = maxLng - minLng || 0.01

      const mapLeft = margin + 2
      const mapTop = y + 2
      const mapWidth = contentWidth - 4
      const mapHeight = 46

      // Draw route line connecting waypoints
      doc.setDrawColor(0, 120, 200)
      doc.setLineWidth(0.5)

      for (let i = 0; i < waypoints.length - 1; i++) {
        const wp1 = waypoints[i]
        const wp2 = waypoints[i + 1]
        const x1 = mapLeft + ((wp1.lng - minLng) / lngRange) * mapWidth
        const y1 = mapTop + mapHeight - ((wp1.lat - minLat) / latRange) * mapHeight
        const x2 = mapLeft + ((wp2.lng - minLng) / lngRange) * mapWidth
        const y2 = mapTop + mapHeight - ((wp2.lat - minLat) / latRange) * mapHeight
        doc.line(x1, y1, x2, y2)
      }

      // Mark start and end
      const startWp = waypoints[0]
      const endWp = waypoints[waypoints.length - 1]
      const startX = mapLeft + ((startWp.lng - minLng) / lngRange) * mapWidth
      const startY = mapTop + mapHeight - ((startWp.lat - minLat) / latRange) * mapHeight
      const endX = mapLeft + ((endWp.lng - minLng) / lngRange) * mapWidth
      const endY = mapTop + mapHeight - ((endWp.lat - minLat) / latRange) * mapHeight

      // Start marker (green)
      doc.setFillColor(0, 180, 0)
      doc.circle(startX, startY, 3, 'F')
      doc.setFontSize(7)
      doc.setTextColor(0, 140, 0)
      doc.text('START', startX + 5, startY + 2)

      // End marker (red)
      doc.setFillColor(220, 0, 0)
      doc.circle(endX, endY, 3, 'F')
      doc.setTextColor(200, 0, 0)
      doc.text('END', endX + 5, endY + 2)

      y += 55
    } else {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      doc.text('Insufficient waypoints for map sketch', margin, y)
      y += 8
    }

    // QR Code placeholder
    y += 5
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Share QR Code', margin, y)
    y += 8

    // Draw QR code placeholder box
    const qrSize = 30
    doc.setDrawColor(180, 180, 180)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(margin, y, qrSize, qrSize, 2, 2, 'FD')

    // Draw QR pattern placeholder
    doc.setFillColor(0, 0, 0)
    const cellSize = qrSize / 15
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        // Create a pseudo-QR pattern with finder patterns
        const isFinderTopLeft = row < 5 && col < 5
        const isFinderTopRight = row < 5 && col >= 10
        const isFinderBottomLeft = row >= 10 && col < 5

        let fill = false
        if (isFinderTopLeft || isFinderTopRight || isFinderBottomLeft) {
          // Finder pattern: outer border, then white, then black center
          const localRow = row % 5
          const localCol = col % 5
          if (localRow === 0 || localRow === 4 || localCol === 0 || localCol === 4) fill = true
          if (localRow >= 2 && localRow <= 2 && localCol >= 2 && localCol <= 2) fill = true
        } else if ((row + col) % 3 === 0) {
          fill = true
        }

        if (fill) {
          doc.rect(margin + col * cellSize, y + row * cellSize, cellSize, cellSize, 'F')
        }
      }
    }

    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Scan to view route', margin + qrSize + 5, y + 10)
    doc.text(`Route ID: ${route.id}`, margin + qrSize + 5, y + 18)
    doc.text(`mototrack.app/route/${route.id}`, margin + qrSize + 5, y + 26)

    y += qrSize + 10

    // Footer
    if (y > 270) {
      doc.addPage()
      y = 20
    }

    doc.setDrawColor(200, 200, 200)
    doc.line(margin, 280, pageWidth - margin, 280)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('MotoTrack - Motorcycle Ride Tracker', margin, 286)
    doc.text(`Route: ${route.title} | ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, 286, { align: 'right' })

    // Return PDF as download
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const safeTitle = route.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="MotoTrack_${safeTitle}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
