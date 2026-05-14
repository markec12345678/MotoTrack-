import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Available regions for offline download - Balkans focused
const MAP_REGIONS = [
  // Slovenia sub-regions
  { id: 'slovenia-full', name: '🇸🇮 Slovenija (celotna)', bounds: { north: 46.88, south: 45.42, east: 16.61, west: 13.38 }, zoomLevels: '8-14', estimatedSizeMB: 150, tileSource: 'osm' },
  { id: 'ljubljana-region', name: '🏘️ Ljubljana in okolica', bounds: { north: 46.25, south: 45.95, east: 14.85, west: 14.25 }, zoomLevels: '10-16', estimatedSizeMB: 80, tileSource: 'osm' },
  { id: 'gorenjska', name: '🏔️ Gorenjska (Julijske Alpe)', bounds: { north: 46.65, south: 46.15, east: 14.45, west: 13.65 }, zoomLevels: '10-15', estimatedSizeMB: 60, tileSource: 'osm' },
  { id: 'primorska', name: '🌊 Primorska in Obala', bounds: { north: 46.05, south: 45.45, east: 14.25, west: 13.38 }, zoomLevels: '10-15', estimatedSizeMB: 55, tileSource: 'osm' },
  // Balkans countries
  { id: 'croatia', name: '🇭🇷 Hrvaška', bounds: { north: 46.55, south: 42.40, east: 19.43, west: 13.49 }, zoomLevels: '8-14', estimatedSizeMB: 250, tileSource: 'osm' },
  { id: 'bosnia', name: '🇧🇦 Bosna in Hercegovina', bounds: { north: 45.28, south: 42.55, east: 19.63, west: 15.72 }, zoomLevels: '8-14', estimatedSizeMB: 150, tileSource: 'osm' },
  { id: 'montenegro', name: '🇲🇪 Črna gora', bounds: { north: 43.56, south: 41.85, east: 20.35, west: 18.45 }, zoomLevels: '8-14', estimatedSizeMB: 80, tileSource: 'osm' },
  { id: 'albania', name: '🇦🇱 Albanija', bounds: { north: 42.66, south: 39.64, east: 21.06, west: 19.28 }, zoomLevels: '8-14', estimatedSizeMB: 100, tileSource: 'osm' },
  // Neighboring countries (partial)
  { id: 'austria', name: '🇦🇹 Avstrija', bounds: { north: 49.02, south: 46.37, east: 17.16, west: 9.53 }, zoomLevels: '8-14', estimatedSizeMB: 200, tileSource: 'osm' },
  { id: 'italy-north', name: '🇮🇹 Severna Italija', bounds: { north: 47.08, south: 43.80, east: 13.73, west: 6.63 }, zoomLevels: '8-14', estimatedSizeMB: 180, tileSource: 'osm' },
  { id: 'hungary', name: '🇭🇺 Madžarska', bounds: { north: 48.58, south: 45.74, east: 22.90, west: 16.11 }, zoomLevels: '8-14', estimatedSizeMB: 160, tileSource: 'osm' },
  // Balkans overview
  { id: 'balkans-overview', name: '🗺️ Balkan - pregled', bounds: { north: 47.5, south: 39.5, east: 23.0, west: 13.0 }, zoomLevels: '6-10', estimatedSizeMB: 100, tileSource: 'osm' },
]

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    // Get downloaded regions from DB
    const downloadedMaps = userId
      ? await db.offlineMap.findMany({ where: { userId } })
      : []

    const downloadedMapIds = new Set(downloadedMaps.map(m => m.regionId))
    const downloadedAtMap = new Map(downloadedMaps.map(m => [m.regionId, m.downloadedAt.toISOString()]))

    const data = MAP_REGIONS.map(r => ({
      id: r.id,
      name: r.name,
      bounds: r.bounds,
      zoomLevels: r.zoomLevels,
      estimatedSizeMB: r.estimatedSizeMB,
      tileSource: r.tileSource || 'osm',
      downloaded: downloadedMapIds.has(r.id),
      downloadedAt: downloadedAtMap.get(r.id) || null,
    }))

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, regionId } = await req.json()
    if (!userId || !regionId) {
      return NextResponse.json({ error: 'userId in regionId sta obvezna' }, { status: 400 })
    }

    const region = MAP_REGIONS.find(r => r.id === regionId)
    if (!region) {
      return NextResponse.json({ error: 'Regija ni bila najdena' }, { status: 404 })
    }

    // Check if already downloaded (allow re-download if deleted)
    const existing = await db.offlineMap.findFirst({
      where: { regionId, userId },
    })
    if (existing) {
      // Update the downloadedAt timestamp
      const updated = await db.offlineMap.update({
        where: { id: existing.id },
        data: { downloadedAt: new Date() },
      })
      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          regionId,
          regionName: region.name,
          downloadedAt: updated.downloadedAt.toISOString(),
        },
      })
    }

    // Create download record
    const offlineMap = await db.offlineMap.create({
      data: { regionId, userId },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: offlineMap.id,
        regionId,
        regionName: region.name,
        downloadedAt: offlineMap.downloadedAt.toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, regionId } = await req.json()
    if (!userId || !regionId) {
      return NextResponse.json({ error: 'userId in regionId sta obvezna' }, { status: 400 })
    }

    // Find the record by regionId AND userId (not just regionId which is unique)
    const existing = await db.offlineMap.findFirst({
      where: { regionId, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Regija ni bila najdena za tega uporabnika' }, { status: 404 })
    }

    await db.offlineMap.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
