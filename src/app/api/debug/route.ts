import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Debug endpoint - check environment variable status
export async function GET() {
  const dbUrl = process.env.DATABASE_URL
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  const nodeEnv = process.env.NODE_ENV

  return NextResponse.json({
    env: {
      NODE_ENV: nodeEnv,
      DATABASE_URL: {
        isSet: !!dbUrl,
        value: dbUrl || 'NOT SET',
        prefix: dbUrl ? dbUrl.substring(0, 15) + '...' : 'N/A',
        length: dbUrl?.length ?? 0,
        startsWithFile: dbUrl?.startsWith('file:') ?? false,
        startsWithLibsql: dbUrl?.startsWith('libsql://') ?? false,
        isUndefined: dbUrl === 'undefined',
      },
      TURSO_DATABASE_URL: {
        isSet: !!tursoUrl,
        prefix: tursoUrl ? tursoUrl.substring(0, 25) + '...' : 'NOT SET',
      },
      TURSO_AUTH_TOKEN: {
        isSet: !!tursoToken,
        length: tursoToken?.length ?? 0,
      },
    },
  })
}
