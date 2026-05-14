import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a PrismaClient with the appropriate connection method:
 * - Turso (libsql) adapter on Vercel/production (when TURSO_DATABASE_URL is set)
 * - Local SQLite in development
 *
 * CRITICAL: When using the Turso adapter, Prisma's internal engine STILL
 * validates the DATABASE_URL from the schema (url = env("DATABASE_URL")).
 * If DATABASE_URL is set to a libsql:// URL on Vercel, Prisma will reject it
 * as invalid for the "sqlite" provider. Therefore, we MUST override
 * DATABASE_URL to a valid SQLite placeholder (file:./dev.db) when using
 * the adapter — the actual connection goes through the adapter, not DATABASE_URL.
 */
function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || ''

  // Only use Turso when both URL and token are provided AND we're in production
  const isTurso = tursoUrl.startsWith('libsql://') &&
                  tursoAuthToken.length > 0 &&
                  process.env.NODE_ENV === 'production'

  // ── Turso (libsql) path — used on Vercel / production ──────────────
  if (isTurso && typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@libsql/client')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')

      const libsql = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      })
      const adapter = new PrismaLibSQL(libsql)

      console.log('[DB] Connected to Turso:', tursoUrl.replace(/\/\/.*@/, '//***@'))

      // CRITICAL FIX: Prisma's internal engine validates DATABASE_URL even
      // when using an adapter. On Vercel, DATABASE_URL might be set to a
      // libsql:// URL which is NOT valid for Prisma's "sqlite" provider.
      // We MUST override it to a valid SQLite placeholder before creating
      // the PrismaClient. The adapter handles the actual connection, so
      // this placeholder value is never used for data access.
      process.env.DATABASE_URL = 'file:./dev.db'

      return new PrismaClient({
        adapter,
        log: ['error'],
      })
    } catch (e) {
      console.error('[DB] Failed to initialize Turso connection, falling back to SQLite:', e)
      // Fall through to local SQLite
    }
  }

  // ── Local SQLite path — used in development ────────────────────────
  // Ensure DATABASE_URL is always set for Prisma's internal validation
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./dev.db'
  }

  const databaseUrl = process.env.DATABASE_URL
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

// Singleton: reuse client in development to avoid connection pool exhaustion
// In production, create a new client each time (serverless functions are isolated)
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
