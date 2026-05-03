// ESLint config for pre-release stabilization
module.exports = {
  overrides: [
    {
      files: [
        "src/**/*.ts",
      ],
      rules: {
        // No Math.random or crypto.randomInt outside reward.service.ts
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
            message: 'Math.random is only allowed in reward.service.ts',
          },
          {
            selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomInt']",
            message: 'crypto.randomInt is only allowed in reward.service.ts',
          },
        ],
        // No inline numeric literals in service layer
        'no-magic-numbers': [
          'error',
          { ignore: [0, 1], enforceConst: true, detectObjects: true },
        ],
      },
    },
  ],
};
