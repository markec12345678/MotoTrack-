const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.TURSO_URL || 'libsql://mototrack-robertpezdirc27.aws-eu-west-1.turso.io';
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!token) {
    console.error('TURSO_AUTH_TOKEN environment variable is required');
    process.exit(1);
  }

  const client = createClient({ url, authToken: token });

  const sqlFile = path.join(__dirname, '..', 'prisma', 'schema.sql');
  let sql;
  try {
    sql = fs.readFileSync(sqlFile, 'utf8');
  } catch {
    console.error('Could not read prisma/schema.sql');
    process.exit(1);
  }

  // Remove comment lines and split by semicolons
  const statements = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Executing ${statements.length} SQL statements on ${url}...`);

  let success = 0;
  let errors = 0;

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      success++;
      process.stdout.write('.');
    } catch (e) {
      if (e.message && (e.message.includes('already exists') || e.message.includes('UNIQUE constraint'))) {
        process.stdout.write('s'); // skip
      } else {
        console.error(`\n  ERROR: ${e.message}`);
        console.error(`  SQL: ${stmt.substring(0, 100)}...`);
        errors++;
      }
    }
  }

  console.log(`\n\nDone! ${success} created, ${errors} errors`);

  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\nTables in Turso database:');
  result.rows.forEach(row => console.log(`  - ${row.name}`));
}

main().catch(console.error);
