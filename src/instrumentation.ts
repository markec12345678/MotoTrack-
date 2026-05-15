/**
 * Next.js Instrumentation - runs BEFORE any other module is loaded.
 *
 * CRITICAL: Prisma's generated client validates DATABASE_URL from the schema
 * (url = env("DATABASE_URL")) at various points during initialization.
 * On Vercel, DATABASE_URL might be:
 * - Not set at all (undefined)
 * - Set to a libsql:// URL (invalid for Prisma's "sqlite" provider)
 * - Set to the literal string "undefined"
 *
 * We MUST ensure DATABASE_URL is a valid SQLite URL before any Prisma
 * code runs. The actual database connection is handled by the Turso
 * adapter in lib/db.ts, so this value is only for Prisma's internal validation.
 */
export async function register() {
  // Only run on the server side
  if (typeof window !== 'undefined') return

  // Log current DATABASE_URL status (without exposing the full value)
  const currentUrl = process.env.DATABASE_URL
  console.log('[Instrumentation] DATABASE_URL status:', {
    isSet: !!currentUrl,
    prefix: currentUrl ? currentUrl.substring(0, 10) + '...' : 'NOT SET',
    length: currentUrl?.length ?? 0,
  })

  // If DATABASE_URL is not set or is invalid for SQLite, override it
  if (!currentUrl || currentUrl === 'undefined' || !currentUrl.startsWith('file:')) {
    console.log('[Instrumentation] Overriding DATABASE_URL to file:./dev.db (was:', currentUrl, ')')
    process.env.DATABASE_URL = 'file:./dev.db'
  }
}
