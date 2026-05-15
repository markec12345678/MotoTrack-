import { NextRequest, NextResponse } from 'next/server'

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
    const body = await req.json()
    const { regionId, minZoom, maxZoom, tileSource } = body
    if (!regionId) {
      return NextResponse.json({ error: 'regionId je obvezen' }, { status: 400 })
    }

    const region = MAP_REGIONS.find(r => r.id === regionId)
    if (!region) {
      return NextResponse.json({ error: 'Regija ni bila najdena' }, { status: 404 })
    }

    // Validate bounds
    const { north, south, east, west } = region.bounds
    if (north <= south || east <= west) {
      return NextResponse.json({ error: 'Neveljavne meje regije' }, { status: 400 })
    }
    if (north > 90 || south < -90 || east > 180 || west < -180) {
      return NextResponse.json({ error: 'Meje regije izven območja' }, { status: 400 })
    }

    // Parse zoom levels from the region definition
    const [defaultMin, defaultMax] = region.zoomLevels.split('-').map(Number)
    const zMin = Math.max(0, minZoom ?? defaultMin)
    const zMax = Math.min(18, maxZoom ?? defaultMax)

    if (zMin > zMax) {
      return NextResponse.json({ error: 'minZoom ne more biti večji od maxZoom' }, { status: 400 })
    }

    // Determine tile source
    const source = tileSource || region.tileSource || 'osm'

    // Generate all tile coordinates for the region across zoom levels
    interface TileInfo {
      z: number
      x: number
      y: number
      url: string
      key: string
    }

    const tiles: TileInfo[] = []
    const tileServerUrls: Record<string, string[]> = {
      osm: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      terrain: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      ],
    }

    for (let z = zMin; z <= zMax; z++) {
      const x1 = lngToTileX(west, z)
      const x2 = lngToTileX(east, z)
      const y1 = latToTileY(north, z)
      const y2 = latToTileY(south, z)

      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      // Safety check: don't generate too many tiles per zoom level
      const tilesPerZoom = (maxX - minX + 1) * (maxY - minY + 1)
      if (tilesPerZoom > 50000) {
        console.warn(`Skipping zoom ${z} for region ${regionId}: too many tiles (${tilesPerZoom})`)
        continue
      }

      const serverUrls = tileServerUrls[source] || tileServerUrls.osm

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          // Pick a server based on x for consistent load balancing
          const serverIdx = x % serverUrls.length
          const templateUrl = serverUrls[serverIdx]
          const url = templateUrl
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))

          tiles.push({
            z,
            x,
            y,
            url,
            key: `tile_region_${regionId}_${source}_${z}_${x}_${y}`,
          })
        }
      }
    }

    return NextResponse.json({
      regionId,
      regionName: region.name,
      bounds: region.bounds,
      zoomRange: { min: zMin, max: zMax },
      tileSource: source,
      totalTiles: tiles.length,
      tiles,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
