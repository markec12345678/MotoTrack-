import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Datoteka ni podana' }, { status: 400 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const text = await file.text()

    // Simple GPX parsing - extract track points
    const points: Array<{ lat: number; lng: number; ele?: number }> = []
    const nameMatch = text.match(/<name>(.*?)<\/name>/)
    const name = nameMatch ? nameMatch[1].trim() : 'Uvožena GPX pot'

    // Try to extract MotoTrack extensions
    let mtCategory = 'scenic'
    let mtDifficulty = 'medium'
    const mtCategoryMatch = text.match(/<mt:category>([^<]+)<\/mt:category>/)
    if (mtCategoryMatch) mtCategory = mtCategoryMatch[1]
    const mtDiffMatch = text.match(/<mt:difficulty>([^<]+)<\/mt:difficulty>/)
    if (mtDiffMatch) mtDifficulty = mtDiffMatch[1]
    const mtTypeMatch = text.match(/<mt:type>([^<]+)<\/mt:type>/)

    // Extract description from GPX metadata
    const descMatch = text.match(/<desc>([\s\S]*?)<\/desc>/)
    const gpxDescription = descMatch ? descMatch[1].trim() : ''

    // Parse trkpt elements
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g
    let match
    while ((match = trkptRegex.exec(text)) !== null) {
      const lat = parseFloat(match[1])
      const lng = parseFloat(match[2])
      const content = match[3]
      let ele: number | undefined
      const eleMatch = content.match(/<ele>([^<]+)<\/ele>/)
      if (eleMatch) ele = parseFloat(eleMatch[1])
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng, ele })
      }
    }

    // Also try wpt elements if no trkpt found
    if (points.length === 0) {
      const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/g
      while ((match = wptRegex.exec(text)) !== null) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push({ lat, lng })
        }
      }
    }

    // Also try rtept elements
    if (points.length === 0) {
      const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/rtept>/g
      while ((match = rteptRegex.exec(text)) !== null) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push({ lat, lng })
        }
      }
    }

    if (points.length < 2) {
      // Record failed import
      await db.gpxImport.create({
        data: {
          userId,
          fileName: file.name,
          fileSize: file.size,
          routeCount: 0,
          trackCount: 0,
          status: 'failed',
          resultData: JSON.stringify({ error: 'GPX datoteka ne vsebuje dovolj točk' }),
        },
      })
      return NextResponse.json({ error: 'GPX datoteka ne vsebuje dovolj točk (najmanj 2)' }, { status: 400 })
    }

    // Calculate distance using haversine
    const R = 6371
    let totalDistance = 0
    for (let i = 1; i < points.length; i++) {
      const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180
      const dLon = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((points[i - 1].lat * Math.PI) / 180) *
        Math.cos((points[i].lat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
      totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    // Create route from imported GPX
    const waypoints = points.map(p => ({ lat: p.lat, lng: p.lng }))
    const routeData = JSON.stringify(points.map(p => [p.lat, p.lng]))

    // Determine if it's a ride (from MotoTrack) or external
    const isMotoTrackExport = mtTypeMatch && (mtTypeMatch[1] === 'ride' || mtTypeMatch[1] === 'route')
    const route = await db.route.create({
      data: {
        title: name,
        description: gpxDescription || `Uvoženo iz GPX datoteke: ${file.name}${isMotoTrackExport ? ' (MotoTrack)' : ''}`,
        distance: Math.round(totalDistance * 10) / 10,
        waypoints: JSON.stringify(waypoints),
        routeData,
        category: mtCategory,
        difficulty: mtDifficulty,
        isPublic: true,
        likes: 0,
        userId,
      },
    })

    // Count tracks (trk elements) and routes (rte elements)
    const trackCount = (text.match(/<trk[\s>]/g) || []).length
    const rteCount = (text.match(/<rte[\s>]/g) || []).length

    // Create GPX import record
    const gpxImport = await db.gpxImport.create({
      data: {
        userId,
        fileName: file.name,
        fileSize: file.size,
        routeCount: 1 + rteCount,
        trackCount,
        status: 'completed',
        resultData: JSON.stringify({ routeId: route.id, routeName: name, distance: Math.round(totalDistance * 10) / 10 }),
      },
    })

    return NextResponse.json({ data: route, import: gpxImport })
  } catch (error) {
    console.error('GPX import error:', error)
    return NextResponse.json({ error: 'Napaka pri uvozu GPX' }, { status: 500 })
  }
}
