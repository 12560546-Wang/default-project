import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        AudioContext: 'readonly',
        devicePixelRatio: 'readonly',
        console: 'readonly',
      },
    },
  },
  prettier,
);
