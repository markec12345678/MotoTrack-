import { NextRequest, NextResponse } from 'next/server'

const MAP_REGIONS = [
  { id: 'slovenia', name: '🇸🇮 Slovenija', bounds: { north: 46.88, south: 45.42, east: 16.61, west: 13.38 }, zoomLevels: '6-15', estimatedSizeMB: 180 },
  { id: 'croatia', name: '🇭🇷 Hrvaška', bounds: { north: 46.55, south: 42.40, east: 19.43, west: 13.49 }, zoomLevels: '6-15', estimatedSizeMB: 350 },
  { id: 'austria', name: '🇦🇹 Avstrija', bounds: { north: 49.02, south: 46.37, east: 17.16, west: 9.53 }, zoomLevels: '6-15', estimatedSizeMB: 280 },
  { id: 'italy-north', name: '🇮🇹 Severna Italija', bounds: { north: 47.08, south: 43.80, east: 13.73, west: 6.63 }, zoomLevels: '6-15', estimatedSizeMB: 320 },
  { id: 'hungary', name: '🇭🇺 Madžarska', bounds: { north: 48.58, south: 45.74, east: 22.90, west: 16.11 }, zoomLevels: '6-15', estimatedSizeMB: 260 },
  { id: 'germany-south', name: '🇩🇪 Južna Nemčija', bounds: { north: 51.31, south: 47.27, east: 15.05, west: 5.87 }, zoomLevels: '6-15', estimatedSizeMB: 400 },
  { id: 'switzerland', name: '🇨🇭 Švica', bounds: { north: 47.81, south: 45.82, east: 10.49, west: 5.96 }, zoomLevels: '6-15', estimatedSizeMB: 150 },
]

export async function GET() {
  return NextResponse.json({
    data: MAP_REGIONS.map(r => ({ ...r, downloaded: false }))
  })
}

export async function POST(req: NextRequest) {
  try {
    const { userId, regionId } = await req.json()
    if (!userId || !regionId) return NextResponse.json({ error: 'userId and regionId required' }, { status: 400 })
    const region = MAP_REGIONS.find(r => r.id === regionId)
    if (!region) return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    return NextResponse.json({ data: { success: true, regionId, regionName: region.name, downloadedAt: new Date().toISOString() } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
