import { NextResponse } from 'next/server'

// Fallback REST API for group chat (when socket.io is unavailable)
const messageStore = new Map<string, Array<{
  id: string
  userName: string
  message: string
  type: string
  timestamp: number
  lat?: number
  lng?: number
}>>()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rideId = searchParams.get('rideId')

    if (!rideId) {
      return NextResponse.json({ error: 'rideId is required' }, { status: 400 })
    }

    const messages = messageStore.get(rideId) || []
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Napaka pri pridobivanju sporočil' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rideId, userName, message, type = 'text', lat, lng } = body

    if (!rideId || !userName || !message) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    if (!messageStore.has(rideId)) {
      messageStore.set(rideId, [])
    }

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userName,
      message,
      type,
      timestamp: Date.now(),
      lat,
      lng,
    }

    const messages = messageStore.get(rideId)!
    messages.push(msg)
    if (messages.length > 50) {
      messageStore.set(rideId, messages.slice(-50))
    }

    return NextResponse.json({ success: true, message: msg })
  } catch {
    return NextResponse.json({ error: 'Napaka pri pošiljanju sporočila' }, { status: 500 })
  }
}
