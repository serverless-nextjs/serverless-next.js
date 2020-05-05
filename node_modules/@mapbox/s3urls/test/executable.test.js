'use strict';

const test = require('tape').test;
const exec = require('cross-exec-file');
const path = require('path');
const cmd = path.resolve(__dirname, '..', 'bin', 's3urls.js');

test('bad command', (t) => {
  exec(cmd, ['ham'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: Invalid command\n', 'expected message');
    t.end();
  });
});

test('toUrl: bad args', (t) => {
  exec(cmd, ['to-url'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: Must specify bucket and key\n', 'expected message');
    t.end();
  });
});

test('toUrl: all types', (t) => {
  const expected = [
    's3://bucket/key',
    'https://s3.amazonaws.com/bucket/key',
    'https://bucket.s3.amazonaws.com/key'
  ];

  exec(cmd, ['to-url', 'bucket', 'key'], (err, stdout) => {
    t.ifError(err, 'completed');
    stdout.trim().split('\n').forEach((url) => {
      t.ok(expected.indexOf(url) > -1, 'expected url');
    });
    t.end();
  });
});

test('toUrl: s3 type', (t) => {
  const expected = 's3://bucket/key';

  exec(cmd, ['to-url', 'bucket', 'key', '--type', 's3'], (err, stdout) => {
    t.ifError(err, 'completed');
    t.equal(stdout, expected + '\n', 'expected url');
    t.end();
  });
});

test('toUrl: bucket-in-path type', (t) => {
  const expected = 'https://s3.amazonaws.com/bucket/key';

  exec(cmd, ['to-url', 'bucket', 'key', '--type', 'bucket-in-path'], (err, stdout) => {
    t.ifError(err, 'completed');
    t.equal(stdout, expected + '\n', 'expected url');
    t.end();
  });
});

test('toUrl: bucket-in-host type', (t) => {
  const expected = 'https://bucket.s3.amazonaws.com/key';

  exec(cmd, ['to-url', 'bucket', 'key', '--type', 'bucket-in-host'], (err, stdout) => {
    t.ifError(err, 'completed');
    t.equal(stdout, expected + '\n', 'expected url');
    t.end();
  });
});

test('fromUrl: no url', (t) => {
  exec(cmd, ['from-url'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: No url given\n', 'expected message');
    t.end();
  });
});

test('fromUrl: unrecognized url', (t) => {
  exec(cmd, ['from-url', 'http://www.google.com'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: Unrecognizable S3 url\n', 'expected message');
    t.end();
  });
});

test('fromUrl: success', (t) => {
  exec(cmd, ['from-url', 's3://bucket/key'], (err, stdout) => {
    t.equal(stdout, JSON.stringify({
      Bucket: 'bucket',
      Key: 'key'
    }) + '\n', 'expected result');
    t.end();
  });
});

test('convert: no url', (t) => {
  exec(cmd, ['convert'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: No url given\n', 'expected message');
    t.end();
  });
});

test('convert: unrecognized url', (t) => {
  exec(cmd, ['convert', 'http://www.google.com'], (err, stdout, stderr) => {
    t.equal(err.code, 1, 'exit 1');
    t.equal(stderr, 'ERROR: Unrecognizable S3 url\n', 'expected message');
    t.end();
  });
});

test('convert: default success', (t) => {
  exec(cmd, ['convert', 's3://bucket/key'], (err, stdout) => {
    t.equal(stdout, 'https://bucket.s3.amazonaws.com/key\n', 'expected result');
    t.end();
  });
});

test('convert: typed success', (t) => {
  exec(cmd, ['convert', 's3://bucket/key', '--type', 'bucket-in-path'], (err, stdout) => {
    t.equal(stdout, 'https://s3.amazonaws.com/bucket/key\n', 'expected result');
    t.end();
  });
});
