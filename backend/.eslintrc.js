// ESLint configuration for backend: Enforce Decimal safety in financial logic
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'custom-money-safety'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Block unsafe numeric operations in financial logic
    'custom-money-safety/no-unsafe-number': 'error',
    'custom-money-safety/no-unsafe-arithmetic': 'error',
    'custom-money-safety/no-unsafe-parseint': 'error',
    'custom-money-safety/no-implicit-coercion': 'error',
    'eqeqeq': ['error', 'always'],
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
    'custom-money-safety/rulesdir': './eslint-rules',
  },
};
