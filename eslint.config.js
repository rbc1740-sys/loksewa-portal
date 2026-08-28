// ESLint Config for Loksewa Portal
export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'tests/',
      '*.config.js',
      'playwright-report/',
      'src/',
      'firebase-config.js',
      'index.html',
      'app.html',
      'sw.js',
      'coverage/',
    ],
  },
  {
    files: ['*.js', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        browser: true,
        es2022: true,
        node: true,
      },
    },
    rules: {
      // Possible Errors
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Best Practices
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Style
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': 'error',
      'space-before-function-paren': [
        'error',
        { named: 'never', anonymous: 'always', asyncArrow: 'always' },
      ],

      // Complexity
      'max-nested-callbacks': ['warn', 4],
      'max-depth': ['warn', 4],
      complexity: ['warn', 20],

      // ES6+
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'prefer-destructuring': ['warn', { array: false, object: true }],
    },
  },
];
