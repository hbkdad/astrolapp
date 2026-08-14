/**
 * Verify the database migrations against real PostgreSQL.
 *
 * Applying a migration proves only that it parses. This spins up a throwaway
 * PostgreSQL 17 container — the same major version Supabase runs — applies the
 * migrations, and then runs assertions that prove BEHAVIOUR: that row-level
 * security actually isolates one user's birth data from another's, that the
 * derived cache tables are covered too, and that constraints reject what they
 * were written to reject.
 *
 * Requires Docker. Skips with a clear message if Docker is unavailable, so it
 * does not break a machine that simply has not got it.
 *
 *   pnpm verify:schema
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'packages', 'db', 'migrations');
const SCRIPTS = join(HERE, '..', 'packages', 'db', 'scripts');

const CONTAINER = 'astrolapp-schema-verify';
const IMAGE = 'postgres:17-alpine';
const PASSWORD = 'verify';
const DATABASE = 'astrolapp';

function docker(args: string[], options: { quiet?: boolean } = {}): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    // Container paths must not be translated by Git Bash on Windows.
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });
  if (result.status !== 0 && options.quiet !== true) {
    throw new Error(
      `docker ${args.slice(0, 3).join(' ')} failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function removeContainer(): void {
  docker(['rm', '-f', CONTAINER], { quiet: true });
}

/** Copy a file in and run it through psql, failing on the first error. */
function runSqlFile(hostPath: string, containerName: string): string {
  docker(['cp', hostPath, `${CONTAINER}:/tmp/${containerName}`]);
  const output = docker([
    'exec',
    '-e',
    `PGPASSWORD=${PASSWORD}`,
    CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    DATABASE,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    `/tmp/${containerName}`,
  ]);
  return output;
}

function waitForReady(): void {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      'docker',
      ['exec', CONTAINER, 'pg_isready', '-U', 'postgres', '-d', DATABASE],
      { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
    );
    if (result.status === 0) return;
    // Busy-wait without a sleep dependency.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('PostgreSQL did not become ready within 60 seconds');
}

function main(): void {
  if (!dockerAvailable()) {
    console.log('SKIPPED: Docker is not available, so the schema cannot be verified here.');
    process.exit(0);
  }

  console.log(`Starting ${IMAGE}…`);
  removeContainer();
  docker([
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    `POSTGRES_PASSWORD=${PASSWORD}`,
    '-e',
    `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);

  try {
    waitForReady();

    console.log('Applying 0001_core_schema.sql…');
    runSqlFile(join(MIGRATIONS, '0001_core_schema.sql'), '0001.sql');

    console.log('Applying the Supabase auth stub (test harness only)…');
    runSqlFile(join(SCRIPTS, 'supabase-auth-stub.sql'), 'auth_stub.sql');

    console.log('Applying 0002_row_level_security.sql…');
    runSqlFile(join(MIGRATIONS, '0002_row_level_security.sql'), '0002.sql');

    console.log('Verifying behaviour…');
    const output = runSqlFile(join(SCRIPTS, 'verify-schema.sql'), 'verify.sql');

    if (!output.includes('SCHEMA VERIFICATION PASSED')) {
      console.error(output);
      throw new Error('Schema verification did not report success');
    }

    console.log('\nSchema verification passed:');
    console.log('  - both migrations apply cleanly');
    console.log('  - RLS is enabled on every user-data table');
    console.log("  - one user cannot read another user's birth data or derived charts");
    console.log('  - a client cannot alter its own subscription or forge a chart');
    console.log('  - constraints and cascade deletes behave as written');
  } finally {
    removeContainer();
  }
}

main();
