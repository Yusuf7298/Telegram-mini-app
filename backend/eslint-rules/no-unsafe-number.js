/**
 * Custom ESLint rule: no-unsafe-number
 * Blocks Number(...), parseFloat, and suggests using Prisma.Decimal methods instead
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unsafe number parsing in financial logic',
    },
    messages: {
      unsafeNumber: 'Use Prisma.Decimal methods instead of Number(...) or parseFloat for money.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          (node.callee.type === 'Identifier' && node.callee.name === 'Number') ||
          (node.callee.type === 'Identifier' && node.callee.name === 'parseFloat')
        ) {
          context.report({
            node,
            messageId: 'unsafeNumber',
          });
        }
      },
    };
  },
};
