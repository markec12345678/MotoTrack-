import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Tile proxy - solves CSP/CORS issues on Vercel by serving map tiles from same origin
// Supported providers: carto, osm, esri, opentopomap, rainviewer, openfreemap, elevation

const PROVIDERS: Record<string, { baseUrl: string; format: string }> = {
  'carto-voyager': {
    baseUrl: 'https://basemaps.cartocdn.com/rastertiles/voyager',
    format: 'png',
  },
  'carto-dark': {
    baseUrl: 'https://basemaps.cartocdn.com/dark_all',
    format: 'png',
  },
  'carto-light': {
    baseUrl: 'https://basemaps.cartocdn.com/light_all',
    format: 'png',
  },
  'osm': {
    baseUrl: 'https://tile.openstreetmap.org',
    format: 'png',
  },
  'opentopomap': {
    baseUrl: 'https://tile.opentopomap.org',
    format: 'png',
  },
  'esri': {
    baseUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile',
    format: 'jpeg',
  },
  'elevation': {
    baseUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium',
    format: 'png',
  },
  'rainviewer': {
    baseUrl: 'https://tilecache.rainviewer.com/v2/radar/latest/256',
    format: 'png',
  },
  'openfreemap': {
    baseUrl: 'https://tiles.openfreemap.org/planet',
    format: 'pbf',
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider') || 'carto-voyager'
  const z = searchParams.get('z')
  const x = searchParams.get('x')
  const y = searchParams.get('y')

  if (!z || !x || !y) {
    return NextResponse.json({ error: 'Missing z, x, y parameters' }, { status: 400 })
  }

  const config = PROVIDERS[provider]
  if (!config) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  // Validate tile coordinates to prevent abuse
  const zNum = parseInt(z, 10)
  const xNum = parseInt(x, 10)
  const yNum = parseInt(y, 10)
  if (zNum < 0 || zNum > 22 || xNum < 0 || yNum < 0) {
    return NextResponse.json({ error: 'Invalid tile coordinates' }, { status: 400 })
  }

  // Build tile URL
  let tileUrl: string
  if (provider === 'esri') {
    // Esri uses {z}/{y}/{x} format
    tileUrl = `${config.baseUrl}/${z}/${y}/${x}`
  } else {
    tileUrl = `${config.baseUrl}/${z}/${x}/${y}.${config.format}`
  }

  // Add @2x suffix for retina displays (except vector tiles)
  const retina = searchParams.get('retina')
  if (retina === '1' && config.format !== 'pbf') {
    tileUrl = tileUrl.replace(`.${config.format}`, '@2x.png')
  }

  try {
    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'MotoTrack/1.0 (https://mototrack.app)',
        'Accept': config.format === 'pbf' ? 'application/x-protobuf' : 'image/*',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Tile fetch failed: ${response.status}` },
        { status: response.status === 404 ? 404 : 502 }
      )
    }

    const contentType = config.format === 'pbf'
      ? 'application/x-protobuf'
      : config.format === 'jpeg'
        ? 'image/jpeg'
        : 'image/png'

    const data = await response.arrayBuffer()

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
        'X-Provider': provider,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[tile-proxy] Error fetching ${tileUrl}:`, message)
    return NextResponse.json(
      { error: 'Tile fetch failed', details: message },
      { status: 502 }
    )
  }
}
