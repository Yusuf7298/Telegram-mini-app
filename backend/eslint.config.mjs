import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';

const compat = new FlatCompat();

export default [
  ...compat.extends('eslint:recommended'),
  ...compat.extends('plugin:@typescript-eslint/recommended'),
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      'custom-money-safety': require('./eslint-rules'),
    },
    rules: {
      'custom-money-safety/no-unsafe-number': 'error',
      'custom-money-safety/no-unsafe-arithmetic': 'error',
      'custom-money-safety/no-unsafe-parseint': 'error',
      'custom-money-safety/no-implicit-coercion': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
];
