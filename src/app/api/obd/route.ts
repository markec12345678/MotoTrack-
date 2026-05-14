import { NextResponse } from 'next/server'

// OBD/IoT Motorcycle Connection (simulated)
export async function GET() {
  return NextResponse.json({ data: { connected: false, device: null, dashboard: null } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    if (action === 'connect') {
      // Simulate OBD connection
      return NextResponse.json({
        data: {
          connected: true,
          device: 'MotoLink OBD-II Adapter',
          dashboard: {
            rpm: 3500,
            speed: 0,
            engineTemp: 85,
            fuelLevel: 75,
            batteryVoltage: 12.8,
            oilPressure: 3.2,
            gear: 'N',
            errorCodes: [],
          }
        }
      })
    }
    if (action === 'dashboard') {
      // Simulate live data
      return NextResponse.json({
        data: {
          rpm: 2500 + Math.round(Math.random() * 5000),
          speed: Math.round(Math.random() * 120),
          engineTemp: 80 + Math.round(Math.random() * 30),
          fuelLevel: 50 + Math.round(Math.random() * 30),
          batteryVoltage: Math.round((12 + Math.random() * 1.5) * 10) / 10,
          oilPressure: Math.round((2.5 + Math.random() * 2) * 10) / 10,
          gear: ['N', '1', '2', '3', '4', '5', '6'][Math.floor(Math.random() * 7)],
          errorCodes: [],
        }
      })
    }
    if (action === 'disconnect') {
      return NextResponse.json({ data: { connected: false } })
    }
    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
