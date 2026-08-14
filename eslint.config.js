import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'coverage/**',
      // The web app has its own TypeScript project (JSX, DOM libs, Next plugin)
      // that the root project deliberately does not include. It is type-checked
      // and built by its own scripts, which `pnpm verify` runs.
      'apps/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The deterministic engines must not silently accept untyped data.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // Engine code guards impossible branches deliberately; those guards are
      // not redundant just because the type system believes they are.
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    // Tests use non-null assertions on fixture lookups, which is clearer than
    // defensive branching that can never run.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
