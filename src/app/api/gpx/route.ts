import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const imports = await db.gpxImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const data = imports.map(imp => ({
      id: imp.id,
      fileName: imp.fileName,
      fileSize: imp.fileSize,
      routeCount: imp.routeCount,
      trackCount: imp.trackCount,
      status: imp.status === 'completed' ? 'success' : imp.status === 'failed' ? 'error' : imp.status,
      resultData: imp.resultData,
      createdAt: imp.createdAt.toISOString(),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GPX list error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju zgodovine uvozov' }, { status: 500 })
  }
}
