/**
 * Custom ESLint rule: no-unsafe-arithmetic
 * Blocks arithmetic operators (+, -, *, /) on money variables
 * Suggests using Prisma.Decimal methods instead
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unsafe arithmetic on money variables',
    },
    messages: {
      unsafeArithmetic: 'Use Prisma.Decimal methods instead of arithmetic operators for money.',
    },
    schema: [],
  },
  create(context) {
    function isMoneyVariable(node) {
      // Heuristic: variable name contains 'money', 'amount', 'balance', 'total', 'reward', 'wallet', 'in', 'out', 'sum', 'value'
      if (!node) return false;
      if (node.type === 'Identifier') {
        const name = node.name.toLowerCase();
        return /money|amount|balance|total|reward|wallet|in|out|sum|value/.test(name);
      }
      return false;
    }
    return {
      BinaryExpression(node) {
        const operators = ['+', '-', '*', '/'];
        if (
          operators.includes(node.operator) &&
          (isMoneyVariable(node.left) || isMoneyVariable(node.right))
        ) {
          context.report({
            node,
            messageId: 'unsafeArithmetic',
          });
        }
      },
    };
  },
};
