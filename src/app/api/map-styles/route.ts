import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const config = await db.mapStyleConfig.findUnique({ where: { userId } })
    if (!config) {
      return NextResponse.json({
        data: { styleName: 'streets', customUrl: null, overlayTraffic: false, overlayWeather: false, overlayHazards: true, overlayPois: true }
      })
    }
    return NextResponse.json({ data: config })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, styleName, customUrl, overlayTraffic, overlayWeather, overlayHazards, overlayPois } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const config = await db.mapStyleConfig.upsert({
      where: { userId },
      update: { styleName, customUrl, overlayTraffic, overlayWeather, overlayHazards, overlayPois },
      create: { userId, styleName: styleName || 'streets', customUrl, overlayTraffic: overlayTraffic || false, overlayWeather: overlayWeather || false, overlayHazards: overlayHazards ?? true, overlayPois: overlayPois ?? true }
    })

    return NextResponse.json({ data: config })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
