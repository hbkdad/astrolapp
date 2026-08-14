/**
 * Pre-release gate.
 *
 * `pnpm verify` proves the code is correct. This proves the DEPLOYMENT is
 * configured — a different question, and the one that quietly breaks launches.
 *
 * Every check here corresponds to a failure that is invisible in development
 * and expensive in production.
 *
 *   pnpm release-check
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface Check {
  readonly name: string;
  readonly detail: string;
  readonly ok: boolean;
  /** Advisory checks warn; required checks fail the run. */
  readonly required: boolean;
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail: string, required = true): void {
  checks.push({ name, ok, detail, required });
}

// --- Canonical host -------------------------------------------------------
const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? '';
check(
  'NEXT_PUBLIC_SITE_URL is set to a real host',
  siteUrl.length > 0 && !siteUrl.includes('localhost'),
  siteUrl.length === 0
    ? 'Unset. Canonical tags, Open Graph URLs and sitemap.xml would all point at localhost.'
    : `Set to ${siteUrl}`,
);

check(
  'NEXT_PUBLIC_SITE_URL has no trailing slash and uses https',
  siteUrl.length === 0 || (!siteUrl.endsWith('/') && siteUrl.startsWith('https://')),
  'A trailing slash produces double-slashed canonicals; http produces insecure ones.',
  false,
);

// --- Secrets --------------------------------------------------------------
// The service-role key bypasses row-level security entirely. Any variable
// prefixed NEXT_PUBLIC_ is inlined into the browser bundle, so this pairing
// would hand every visitor unrestricted database access.
const publicServiceRole = Object.keys(process.env).some(
  (key) => key.startsWith('NEXT_PUBLIC_') && key.toUpperCase().includes('SERVICE_ROLE'),
);
check(
  'No service-role key is exposed to the browser',
  !publicServiceRole,
  'A NEXT_PUBLIC_* variable contains SERVICE_ROLE. That key bypasses RLS and would ship to every visitor.',
);

const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  const contents = readFileSync(envPath, 'utf8');
  check(
    '.env is not tracked by git',
    !existsSync(join(ROOT, '.git', 'index')) ||
      !readFileSync(join(ROOT, '.gitignore'), 'utf8')
        .split(/\r?\n/)
        .every((l) => l.trim() !== '.env'),
    '.env must be gitignored.',
  );
  check(
    '.env has no obviously placeholder secrets left',
    !/=\s*(changeme|todo|xxx)\s*$/im.test(contents),
    'Placeholder values found in .env.',
    false,
  );
}

// --- Legal pages ----------------------------------------------------------
// Selling to consumers in the UK/EU requires these to exist and be reachable.
const legalPages = ['privacy', 'terms'];
for (const page of legalPages) {
  check(
    `A ${page} page exists`,
    existsSync(join(ROOT, 'apps', 'web', 'src', 'app', page, 'page.tsx')),
    `apps/web/src/app/${page}/page.tsx is missing. Required before taking payment or collecting personal data.`,
  );
}

// --- Report ---------------------------------------------------------------
const failures = checks.filter((c) => !c.ok && c.required);
const warnings = checks.filter((c) => !c.ok && !c.required);

for (const item of checks) {
  const mark = item.ok ? 'PASS' : item.required ? 'FAIL' : 'WARN';
  console.log(`${mark.padEnd(5)} ${item.name}`);
  if (!item.ok) console.log(`      ${item.detail}`);
}

console.log(
  `\n${checks.length - failures.length - warnings.length} passed, ` +
    `${warnings.length} warning(s), ${failures.length} failure(s).`,
);

if (failures.length > 0) {
  console.error('\nRelease blocked. Fix the failures above.');
  process.exit(1);
}
