'use strict';

module.exports = {
  extends: 'eslint:recommended',
  env: {
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: {
    'no-var': 'error',
    'prefer-const': 'error',
    'eqeqeq': ['error', 'smart'],
    'no-confusing-arrow': ['error', { allowParens: false }],
    'no-extend-native': 'error',
    'no-use-before-define': ['error', 'nofunc'],
    'strict': 'error',
    'no-console': 'off',

    // Code style
    'arrow-parens': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'computed-property-spacing': ['error', 'never'],
    'eol-last': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-spaced-func': 'error',
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', 'avoid-escape'],
    'semi': ['error', 'always'],
    'space-infix-ops': 'error',
    'spaced-comment': ['error', 'always'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'template-curly-spacing': ['error', 'never'],
    'semi-spacing': 'error',
    'indent': ['error', 2, { 'SwitchCase': 1 }]
  }
};
