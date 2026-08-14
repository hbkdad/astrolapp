import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Tests import workspace packages by name but resolve to TypeScript source, so
 * a failing test points at the file you would actually edit rather than at
 * compiled output, and no build step is needed before running them.
 */
const resolvePackage = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@astrolapp/shared': resolvePackage('shared'),
      '@astrolapp/astro-engine': resolvePackage('astro-engine'),
      '@astrolapp/numerology-engine': resolvePackage('numerology-engine'),
      '@astrolapp/context-engine': resolvePackage('context-engine'),
      '@astrolapp/interpretation-engine': resolvePackage('interpretation-engine'),
      '@astrolapp/db': resolvePackage('db'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    environment: 'node',
  },
});
