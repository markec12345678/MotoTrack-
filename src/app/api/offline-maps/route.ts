import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Available regions for offline download
const MAP_REGIONS = [
  { id: 'slovenia-full', name: '🇸🇮 Slovenija (celotna)', bounds: { north: 46.88, south: 45.42, east: 16.61, west: 13.38 }, zoomLevels: '6-15', estimatedSizeMB: 850 },
  { id: 'ljubljana-region', name: '🏘️ Ljubljana in okolica', bounds: { north: 46.25, south: 45.95, east: 14.85, west: 14.25 }, zoomLevels: '10-17', estimatedSizeMB: 220 },
  { id: 'gorenjska', name: '🏔️ Gorenjska (Julijske Alpe)', bounds: { north: 46.65, south: 46.15, east: 14.45, west: 13.65 }, zoomLevels: '10-16', estimatedSizeMB: 310 },
  { id: 'primorska', name: '🌊 Primorska in Obala', bounds: { north: 46.05, south: 45.45, east: 14.25, west: 13.38 }, zoomLevels: '10-16', estimatedSizeMB: 280 },
  { id: 'stajerska', name: '🌿 Štajerska in Koroška', bounds: { north: 46.75, south: 46.35, east: 16.10, west: 15.05 }, zoomLevels: '10-16', estimatedSizeMB: 290 },
  { id: 'dolenjska', name: '🌳 Dolenjska in Bela Krajina', bounds: { north: 46.05, south: 45.42, east: 15.70, west: 14.70 }, zoomLevels: '10-16', estimatedSizeMB: 260 },
  { id: 'croatia', name: '🇭🇷 Hrvaška', bounds: { north: 46.55, south: 42.40, east: 19.43, west: 13.49 }, zoomLevels: '6-15', estimatedSizeMB: 350 },
  { id: 'austria', name: '🇦🇹 Avstrija', bounds: { north: 49.02, south: 46.37, east: 17.16, west: 9.53 }, zoomLevels: '6-15', estimatedSizeMB: 280 },
  { id: 'italy-north', name: '🇮🇹 Severna Italija', bounds: { north: 47.08, south: 43.80, east: 13.73, west: 6.63 }, zoomLevels: '6-15', estimatedSizeMB: 320 },
  { id: 'hungary', name: '🇭🇺 Madžarska', bounds: { north: 48.58, south: 45.74, east: 22.90, west: 16.11 }, zoomLevels: '6-15', estimatedSizeMB: 260 },
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

    // Check if already downloaded
    const existing = await db.offlineMap.findUnique({ where: { regionId } })
    if (existing) {
      return NextResponse.json({ error: 'Regija je že prenesena' }, { status: 409 })
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

    const existing = await db.offlineMap.findUnique({ where: { regionId } })
    if (!existing) {
      return NextResponse.json({ error: 'Regija ni bila najdena' }, { status: 404 })
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Nimate pravice za brisanje' }, { status: 403 })
    }

    await db.offlineMap.delete({ where: { regionId } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
