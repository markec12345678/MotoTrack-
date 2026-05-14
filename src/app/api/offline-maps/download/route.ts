import { NextRequest, NextResponse } from 'next/server'

// Available regions for offline download (must match parent route)
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

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z))
}

function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, z)
  )
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { regionId, minZoom, maxZoom } = await req.json()
    if (!regionId) {
      return NextResponse.json({ error: 'regionId je obvezen' }, { status: 400 })
    }

    const region = MAP_REGIONS.find(r => r.id === regionId)
    if (!region) {
      return NextResponse.json({ error: 'Regija ni bila najdena' }, { status: 404 })
    }

    // Parse zoom levels from the region definition
    const [defaultMin, defaultMax] = region.zoomLevels.split('-').map(Number)
    const zMin = minZoom ?? defaultMin
    const zMax = maxZoom ?? defaultMax

    const { north, south, east, west } = region.bounds

    // Generate all tile coordinates for the region across zoom levels
    interface TileInfo {
      z: number
      x: number
      y: number
      url: string
      key: string
    }

    const tiles: TileInfo[] = []

    for (let z = zMin; z <= zMax; z++) {
      const x1 = lngToTileX(west, z)
      const x2 = lngToTileX(east, z)
      const y1 = latToTileY(north, z)
      const y2 = latToTileY(south, z)

      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({
            z,
            x,
            y,
            url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
            key: `tile_${z}_${x}_${y}`,
          })
        }
      }
    }

    return NextResponse.json({
      regionId,
      regionName: region.name,
      bounds: region.bounds,
      zoomRange: { min: zMin, max: zMax },
      totalTiles: tiles.length,
      tiles,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
