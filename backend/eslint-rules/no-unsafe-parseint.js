/**
 * Custom ESLint rule: no-unsafe-parseint
 * Blocks parseInt and suggests using Prisma.Decimal methods instead
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unsafe parseInt in financial logic',
    },
    messages: {
      unsafeParseInt: 'Use Prisma.Decimal methods instead of parseInt for money.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' && node.callee.name === 'parseInt'
        ) {
          context.report({
            node,
            messageId: 'unsafeParseInt',
          });
        }
      },
    };
  },
};
