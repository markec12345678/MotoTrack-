import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { text, speed = 1.0, voice } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    // Limit text length for TTS (max 1024 per API, use 500 to be safe)
    const truncatedText = text.slice(0, 500)

    // Validate speed range (0.5 - 2.0)
    const safeSpeed = Math.max(0.5, Math.min(2.0, speed))

    // Available voices: tongtong, chuichui, xiaochen, jam, kazi, douji, luodo
    // Use 'tongtong' as default (warm, friendly) - 'alloy', 'female' etc. are NOT valid
    const validVoices = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo']
    const safeVoice = voice && validVoices.includes(voice) ? voice : 'tongtong'

    // Use z-ai-web-dev-sdk for TTS (server-side only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Request WAV format directly from the API
    const response = await zai.audio.tts.create({
      input: truncatedText,
      voice: safeVoice,
      speed: safeSpeed,
      response_format: 'wav',
      stream: false,
    })

    // The SDK returns a standard Response object
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))

    if (buffer.length < 44) {
      console.error('TTS API: Empty or too small response, size =', buffer.length)
      return NextResponse.json(
        { success: false, error: 'Napaka pri generiranju govora' },
        { status: 500 }
      )
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: unknown) {
    console.error('TTS API error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { success: false, error: 'Napaka pri generiranju govora. Poskusite znova.' },
      { status: 500 }
    )
  }
}
