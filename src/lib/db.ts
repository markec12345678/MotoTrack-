import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const tursoUrl = process.env.TURSO_DATABASE_URL || ''
  const isTurso = tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('https://')

  if (isTurso && typeof window === 'undefined') {
    // Turso (libsql) connection — used on Vercel/production
    // Uses TURSO_DATABASE_URL for the actual libsql connection,
    // while DATABASE_URL remains a valid SQLite placeholder for Prisma initialization
    try {
      // Dynamic imports for server-side only — tree-shaken on client
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@libsql/client')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')

      const authToken = process.env.TURSO_AUTH_TOKEN || ''
      const libsql = createClient({
        url: tursoUrl,
        authToken,
      })
      const adapter = new PrismaLibSQL(libsql)

      console.log('[DB] Connected to Turso:', tursoUrl.replace(/\/\/.*@/, '//***@'))

      // When using adapter, DATABASE_URL must be a valid SQLite URL for Prisma initialization
      // The adapter overrides the actual connection
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    } catch (e) {
      console.error('[DB] Failed to initialize Turso connection, falling back to SQLite:', e)
      // Fall through to local SQLite
    }
  }

  // Local SQLite connection — used in development
  console.log('[DB] Connected to local SQLite:', databaseUrl.startsWith('file:') ? databaseUrl : 'file:./db/custom.db')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
