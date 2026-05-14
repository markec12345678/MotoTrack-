import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        iceName1: true,
        icePhone1: true,
        iceName2: true,
        icePhone2: true,
        bloodType: true,
        allergies: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('Emergency contacts GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kontaktov' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, iceName1, icePhone1, iceName2, icePhone2, bloodType, allergies } = body

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const user = await db.user.update({
      where: { id: userId },
      data: {
        iceName1: iceName1 ?? null,
        icePhone1: icePhone1 ?? null,
        iceName2: iceName2 ?? null,
        icePhone2: icePhone2 ?? null,
        bloodType: bloodType ?? null,
        allergies: allergies ?? null,
      },
      select: {
        iceName1: true,
        icePhone1: true,
        iceName2: true,
        icePhone2: true,
        bloodType: true,
        allergies: true,
      },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('Emergency contacts PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju kontaktov' }, { status: 500 })
  }
}
