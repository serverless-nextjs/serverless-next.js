'use strict';

const parse = require('url').parse;

const s3urls = module.exports = {
  fromUrl: function(url) {
    const uri = parse(url);
    uri.pathname = decodeURIComponent(uri.pathname || '');

    const style = (function(uri) {
      if (uri.protocol === 's3:') return 's3';
      if (/^s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/.test(uri.hostname)) return 'bucket-in-path';
      if (/\.s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/.test(uri.hostname)) return 'bucket-in-host';
    })(uri);

    let bucket, key;
    if (style === 's3') {
      bucket = uri.hostname;
      key = uri.pathname.slice(1);
    }
    if (style === 'bucket-in-path') {
      bucket = uri.pathname.split('/')[1];
      key = uri.pathname.split('/').slice(2).join('/');
    }
    if (style === 'bucket-in-host') {
      const match = uri.hostname.replace(/\.s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com(\.cn)?/, '');
      if (match.length) {
        bucket = match;
      } else {
        bucket =  uri.hostname.split('.')[0];
      }
      key = uri.pathname.slice(1);
    }

    return {
      Bucket: bucket,
      Key: key
    };
  },

  toUrl: function(bucket, key) {
    return {
      's3': ['s3:/', bucket, key].join('/'),
      'bucket-in-path': ['https://s3.amazonaws.com', bucket, key].join('/'),
      'bucket-in-host': ['https:/', bucket + '.s3.amazonaws.com', key].join('/')
    };
  },

  convert: function(url, to) {
    const params = s3urls.fromUrl(url);
    return s3urls.toUrl(params.Bucket, params.Key)[to];
  },

  signed: require('s3signed'),

  valid: function(url) {
    const params = s3urls.fromUrl(url);
    return params.Bucket && params.Key;
  }
};
