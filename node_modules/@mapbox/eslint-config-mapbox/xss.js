'use strict';

module.exports = {
  env: {
    'browser': true
  },
  plugins: ['xss'],
  rules: {
    'xss/no-mixed-html': 'error',
    'xss/no-location-href-assign': 'error'
  }
};
