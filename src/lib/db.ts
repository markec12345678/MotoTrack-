import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a PrismaClient with the appropriate connection method:
 * - Turso (libsql) adapter on Vercel/production (when TURSO_DATABASE_URL is set)
 * - Local SQLite in development
 *
 * IMPORTANT (Prisma 6.x): PrismaLibSQL is a FACTORY, not an adapter.
 * Pass the config object { url, authToken } directly — do NOT create a
 * client first with createClient(). The factory's connect() method will
 * create the @libsql/client instance internally.
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
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')

      console.log('[DB] Connecting to Turso:', tursoUrl.replace(/\/\/.*@/, '//***@'))

      // CRITICAL: PrismaLibSQL is a FACTORY in Prisma 6.x.
      // Pass config object directly, NOT a createClient() instance.
      // The factory's connect() method creates the client internally.
      const adapter = new PrismaLibSQL({
        url: tursoUrl,
        authToken: tursoAuthToken,
      })

      // DATABASE_URL must be a valid SQLite URL for Prisma's internal validation
      // even when using the adapter. Set it to a placeholder.
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
