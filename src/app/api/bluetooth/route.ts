import { NextResponse } from 'next/server'

// Bluetooth Helmet API
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ data: { supported: 'bluetooth' in navigator, pairedDevices: [], connected: null } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, deviceId } = body
    if (action === 'scan') {
      // Simulated devices
      return NextResponse.json({
        data: [
          { id: 'bh1', name: 'Sena 50S', type: 'helmet', battery: 85 },
          { id: 'bh2', name: 'Cardo Packtalk', type: 'helmet', battery: 72 },
          { id: 'bh3', name: 'Interphone Tour', type: 'helmet', battery: 60 },
        ]
      })
    }
    if (action === 'connect') {
      return NextResponse.json({ data: { connected: true, deviceId, name: 'Sena 50S', battery: 85, volume: 70 } })
    }
    if (action === 'disconnect') {
      return NextResponse.json({ data: { connected: false } })
    }
    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
