import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/release/**',
      'pnpm-lock.yaml'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        module: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' }
      ]
    }
  }
];
