'use strict';

module.exports = {
  extends: require.resolve('./base'),
  plugins: ['promise'],
  rules: {
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/valid-params': 'error'
  }
};
