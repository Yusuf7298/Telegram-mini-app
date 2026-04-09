// Register custom rules for ESLint
module.exports = {
  rules: {
    'no-unsafe-number': require('./no-unsafe-number'),
    'no-unsafe-arithmetic': require('./no-unsafe-arithmetic'),
    'no-unsafe-parseint': require('./no-unsafe-parseint'),
    'no-implicit-coercion': require('./no-implicit-coercion'),
  },
};
