import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

/**
 * Applies pending migrations/*.sql files, in filename order, tracked in a
 * schema_migrations table. Connects as the admin/superuser role (PGUSER,
 * defaulting to 'postgres') — the elevated privilege that DDL (CREATE TABLE,
 * CREATE ROLE, ALTER TABLE ... ENABLE ROW LEVEL SECURITY) requires. The app's
 * own runtime never uses this connection — see src/db/pool.ts.
 */
export async function runMigrations(): Promise<string[]> {
  const client = new Client({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'social_listening',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? 'postgres',
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map(
        (row: { name: string }) => row.name
      )
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        newlyApplied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    return newlyApplied;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations.');
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
