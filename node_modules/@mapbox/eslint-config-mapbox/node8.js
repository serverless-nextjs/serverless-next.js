'use strict';

module.exports = {
  extends: require.resolve('./node'),
  rules: {
    'node/no-unsupported-features': ['error', { version: 8 }]
  }
};
