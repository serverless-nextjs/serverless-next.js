'use strict';

module.exports = {
  extends: require.resolve('./base'),
  parserOptions: {
    sourceType: 'module'
  },
  plugins: ['import'],
  rules: {
    'import/default': 'error',
    'import/export': 'error',
    'import/first': 'error',
    'import/named': 'error',
    'import/namespace': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/no-dynamic-require': 'error',
    'import/no-extraneous-dependencies': 'error',
    'import/no-named-as-default': 'error',
    'import/no-named-as-default-member': 'error',
    'import/no-named-default': 'error',
    'import/no-unresolved': 'error'
  }
};
