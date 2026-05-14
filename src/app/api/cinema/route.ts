import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cinema?rideId=xxx
 * Returns ride data formatted for cinema playback with photos and route info
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')
    if (!rideId) {
      return NextResponse.json({ error: 'Manjka rideId' }, { status: 400 })
    }

    const ride = await db.ride.findUnique({ where: { id: rideId } })
    if (!ride) {
      return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
    }

    // Parse track data
    let trackPoints: number[][] = []
    try {
      trackPoints = JSON.parse(ride.trackData)
    } catch { /* ignore */ }

    // Fetch photos for this ride
    const photos = await db.photo.findMany({
      where: { rideId },
      orderBy: { createdAt: 'asc' },
    })

    // Calculate speeds between points
    const animationPoints = trackPoints.map((p, i) => {
      const speed = i > 0 ? calculateSpeed(trackPoints[i - 1], p) : 0
      return {
        lat: p[0],
        lng: p[1],
        alt: p[2] || 0,
        timestamp: p[3] || 0,
        speed: Math.round(speed * 10) / 10,
        index: i,
      }
    })

    // Map photos to track points by matching timestamps
    const photoEvents = photos.map(photo => {
      const photoTime = new Date(photo.createdAt).getTime()
      // Find closest track point to photo timestamp
      let closestIdx = 0
      let closestDist = Infinity
      animationPoints.forEach((pt, i) => {
        const dist = Math.abs(pt.timestamp - photoTime)
        if (dist < closestDist) {
          closestDist = dist
          closestIdx = i
        }
      })
      return {
        photoIndex: closestIdx,
        photoUrl: photo.url,
        photoCaption: photo.caption || '',
        photoId: photo.id,
      }
    })

    // Detect "stops" (low speed sections) for smart pauses
    const stops: number[] = []
    for (let i = 1; i < animationPoints.length; i++) {
      const prev = animationPoints[i - 1]
      const curr = animationPoints[i]
      if (curr.speed < 5 && prev.speed < 5) {
        // Only add if not too close to another stop
        if (stops.length === 0 || i - stops[stops.length - 1] > 10) {
          stops.push(i)
        }
      }
    }

    return NextResponse.json({
      data: {
        rideId: ride.id,
        title: ride.title,
        distance: ride.distance,
        duration: ride.duration,
        maxSpeed: ride.maxSpeed,
        elevation: ride.elevation,
        totalPoints: animationPoints.length,
        trackPoints: animationPoints,
        photos: photoEvents,
        stops,
      }
    })
  } catch (error) {
    console.error('Cinema API error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

/**
 * POST /api/cinema
 * Generate narration text for a location (reverse geocoding + AI description)
 */
export async function POST(request: NextRequest) {
  try {
    const { lat, lng, userName, speed, altitude, action } = await request.json()

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Manjka koordinate' }, { status: 400 })
    }

    // If action is 'narrate', generate TTS audio
    if (action === 'narrate') {
      const locationName = await reverseGeocode(lat, lng)
      const name = userName || 'Motorist'
      let narration = ''

      if (speed !== undefined && speed < 5) {
        narration = `${name} se je ustavil${locationName ? ` pri ${locationName}` : ''}.`
      } else if (altitude && altitude > 1000) {
        narration = `${name} vozi na ${Math.round(altitude)} metrih nadmorske višine${locationName ? ` v bližini ${locationName}` : ''}.`
      } else {
        narration = `${name} vozi${locationName ? ` skozi ${locationName}` : ' po poti'}.`
      }

      // Use TTS API to generate audio
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default
        const zai = await ZAI.create()

        const response = await zai.audio.tts.create({
          input: narration,
          voice: 'female',
          speed: 1.0,
        })

        if (response.ok) {
          const pcmData = await response.arrayBuffer()
          const pcmBuffer = Buffer.from(pcmData)

          // Create WAV header
          const wavHeader = createWavHeader(pcmBuffer.length)
          const wavBuffer = Buffer.concat([wavHeader, pcmBuffer])

          return new NextResponse(wavBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'audio/wav',
              'Content-Length': wavBuffer.length.toString(),
              'Cache-Control': 'public, max-age=3600',
            },
          })
        }
      } catch (ttsError) {
        console.error('TTS error:', ttsError)
      }

      // Fallback: return text only
      return NextResponse.json({ narration, locationName })
    }

    // Default: just return location info
    const locationName = await reverseGeocode(lat, lng)
    return NextResponse.json({ locationName })
  } catch (error) {
    console.error('Cinema narration error:', error)
    return NextResponse.json({ error: 'Napaka pri generiranju narracije' }, { status: 500 })
  }
}

function createWavHeader(dataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLength, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLength, 40)

  return header
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12&accept-language=sl`,
      { headers: { 'User-Agent': 'MotoTrack/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      return data.address?.village || data.address?.town || data.address?.city || data.address?.county || data.display_name?.split(',')[0] || ''
    }
  } catch { /* ignore */ }
  return ''
}

function calculateSpeed(p1: number[], p2: number[]): number {
  const R = 6371000
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const dt = ((p2[3] || 0) - (p1[3] || 0)) / 1000
  if (dt <= 0) return 0
  return (dist / dt) * 3.6
}
