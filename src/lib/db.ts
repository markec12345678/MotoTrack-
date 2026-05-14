import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Lazy PrismaClient initializer — never called at module scope.
 * Only creates a client when the first DB query is actually made.
 */
function createPrismaClient(): PrismaClient {
  // DATABASE_URL is required by Prisma's schema — provide a sensible default
  // so the client can initialize even if the env var is missing (e.g. during build).
  // When using the Turso adapter, DATABASE_URL is just a placeholder;
  // the actual connection goes through the libsql adapter.
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || ''
  const isTurso = tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('https://')

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
      // The adapter overrides the actual connection.
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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

/**
 * Lazy singleton — the PrismaClient is only created on first access.
 * This prevents crashes during Next.js build / static generation
 * where environment variables may not be available.
 */
let _db: PrismaClient | undefined

export function getDb(): PrismaClient {
  if (!_db) {
    _db = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  }
  return _db
}

/** Convenience default export — lazily evaluated via Proxy */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(real)
    }
    return value
  },
})
