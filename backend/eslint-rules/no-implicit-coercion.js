/**
 * Custom ESLint rule: no-implicit-coercion
 * Blocks implicit coercion (e.g., !!, +var, var|0, etc.)
 * Suggests using explicit Prisma.Decimal methods instead
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow implicit type coercion in financial logic',
    },
    messages: {
      implicitCoercion: 'Use explicit Prisma.Decimal methods instead of implicit coercion.',
    },
    schema: [],
  },
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === '+' || node.operator === '!' || node.operator === '~') {
          context.report({
            node,
            messageId: 'implicitCoercion',
          });
        }
      },
      BinaryExpression(node) {
        if (node.operator === '|') {
          context.report({
            node,
            messageId: 'implicitCoercion',
          });
        }
      },
    };
  },
};
