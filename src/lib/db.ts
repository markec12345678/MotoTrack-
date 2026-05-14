import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a PrismaClient with the appropriate connection method:
 * - Turso (libsql) adapter on Vercel/production (when TURSO_DATABASE_URL is set)
 * - Local SQLite in development
 *
 * IMPORTANT: DATABASE_URL must always be a valid URL for Prisma's internal
 * initialization. When using the Turso adapter, DATABASE_URL is just a
 * placeholder — the actual connection goes through the adapter.
 */
function createPrismaClient(): PrismaClient {
  // DATABASE_URL is required by Prisma schema (url = env("DATABASE_URL")).
  // Provide a sensible default so Prisma can initialize even if the env var
  // is missing (e.g. during Vercel build or Edge runtime).
  // This is critical: without a valid DATABASE_URL, PrismaClient constructor
  // will throw "URL_INVALID: The URL 'undefined' is not in a valid format"
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./dev.db'
  }
  const databaseUrl = process.env.DATABASE_URL
  const tursoUrl = process.env.TURSO_DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || ''
  // Only use Turso when both URL and token are provided AND we're in production
  // In local development, always use SQLite even if Turso vars are in .env
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

      // When using adapter, DATABASE_URL is just a placeholder for Prisma init.
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
