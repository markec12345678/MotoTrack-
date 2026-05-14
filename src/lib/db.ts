import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const isTurso = databaseUrl.startsWith('libsql://')

  if (isTurso && typeof window === 'undefined') {
    // Turso (libsql) connection — used on Vercel/production
    // We need to use dynamic require for server-side only
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@libsql/client')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSql } = require('@prisma/adapter-libsql')

      const authToken = process.env.TURSO_AUTH_TOKEN || ''
      const libsql = createClient({
        url: databaseUrl,
        authToken,
      })
      const adapter = new PrismaLibSql(libsql)
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    } catch (e) {
      console.error('Failed to initialize Turso connection, falling back to SQLite:', e)
      // Fall through to local SQLite
    }
  }

  // Local SQLite connection — used in development
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
