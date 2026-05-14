import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Create WAV header for PCM audio data
 * PCM from z-ai TTS appears to be: 16-bit, mono, 24000Hz
 */
function createWavHeader(dataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)

  // RIFF chunk descriptor
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLength, 4) // ChunkSize
  header.write('WAVE', 8)

  // fmt sub-chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data sub-chunk
  header.write('data', 36)
  header.writeUInt32LE(dataLength, 40)

  return header
}

export async function POST(request: NextRequest) {
  try {
    const { text, speed = 1.0, voice = 'female' } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    // Limit text length for TTS
    const truncatedText = text.slice(0, 500)

    // Use z-ai-web-dev-sdk for TTS (server-side only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const response = await zai.audio.tts.create({
      input: truncatedText,
      voice,
      speed: Math.max(0.5, Math.min(2.0, speed)),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('TTS API error:', errText)
      return NextResponse.json(
        { success: false, error: 'Napaka pri generiranju govora' },
        { status: 500 }
      )
    }

    // Get PCM audio data
    const pcmData = await response.arrayBuffer()
    const pcmBuffer = Buffer.from(pcmData)

    // Create WAV header and combine with PCM data
    const wavHeader = createWavHeader(pcmBuffer.length)
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer])

    return new NextResponse(wavBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('TTS API error:', error?.message || error)
    return NextResponse.json(
      { success: false, error: 'Napaka pri generiranju govora. Poskusite znova.' },
      { status: 500 }
    )
  }
}
