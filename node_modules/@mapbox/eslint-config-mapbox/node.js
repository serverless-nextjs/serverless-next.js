'use strict';

module.exports = {
  extends: require.resolve('./base'),
  env: {
    node: true
  },
  plugins: ['node'],
  rules: {
    'node/no-unsupported-features': ['error'],
    'node/no-missing-require': 'error'
  }
};
