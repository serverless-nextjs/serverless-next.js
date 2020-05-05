'use strict';

const test = require('tape').test;
const s3Urls = require('..');

test('toUrl', (t) => {
  const result = s3Urls.toUrl('bucket', 'key');
  t.equal(result.s3, 's3://bucket/key', 'expected s3 url');
  t.equal(result['bucket-in-path'], 'https://s3.amazonaws.com/bucket/key', 'expected bucket-in-path url');
  t.equal(result['bucket-in-host'], 'https://bucket.s3.amazonaws.com/key', 'expected bucket-in-host url');
  t.end();
});

test('fromUrl: unrecognized url', (t) => {
  const result = s3Urls.fromUrl('http://www.google.com');
  t.notOk(result.Bucket, 'no bucket');
  t.notOk(result.Key, 'no key');
  t.end();
});

test('fromUrl: s3 style', (t) => {
  const result = s3Urls.fromUrl('s3://bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: s3 style - dot', (t) => {
  const result = s3Urls.fromUrl('s3://results.openaddresses.io/the/whole/key');
  t.equal(result.Bucket, 'results.openaddresses.io', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: s3 bucket only style', (t) => {
  const result = s3Urls.fromUrl('s3://bucket');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, '', 'expected key');
  t.end();
});

test('fromUrl: s3 bucket only style with slash', (t) => {
  const result = s3Urls.fromUrl('s3://bucket/');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, '', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path style', (t) => {
  const result = s3Urls.fromUrl('https://s3.amazonaws.com/bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path style in cn-north-1', (t) => {
  const result = s3Urls.fromUrl('https://s3.cn-north-1.amazonaws.com.cn/bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path style in cn-north-1 w/ dot bucket', (t) => {
  const result = s3Urls.fromUrl('https://s3.cn-north-1.amazonaws.com.cn/results.openaddresses.io/the/whole/key');
  t.equal(result.Bucket, 'results.openaddresses.io', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path style in ap-southeast-1', (t) => {
  const result = s3Urls.fromUrl('https://s3.ap-southeast-1.amazonaws.com/bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path dashed in cn-north-1', (t) => {
  const result = s3Urls.fromUrl('https://s3-cn-north-1.amazonaws.com.cn/bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-path dashed in ap-southeast-1', (t) => {
  const result = s3Urls.fromUrl('https://s3-ap-southeast-1.amazonaws.com/bucket/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host style', (t) => {
  const result = s3Urls.fromUrl('https://bucket.s3.amazonaws.com/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host style in cn-north-1 w/ dot', (t) => {
  const result = s3Urls.fromUrl('https://results.openaddresses.io.s3.cn-north-1.amazonaws.com.cn/the/whole/key');
  t.equal(result.Bucket, 'results.openaddresses.io', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host style in cn-north-1 w/ dot & s3', (t) => {
  const result = s3Urls.fromUrl('https://results.s3llout-to-the-man.io.s3.amazonaws.com/the/whole/key');
  t.equal(result.Bucket, 'results.s3llout-to-the-man.io', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host style in cn-north-1', (t) => {
  const result = s3Urls.fromUrl('https://bucket.s3.cn-north-1.amazonaws.com.cn/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host style in ap-southeast-1', (t) => {
  const result = s3Urls.fromUrl('https://bucket.s3.ap-southeast-1.amazonaws.com/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host dashed in cn-north-1', (t) => {
  const result = s3Urls.fromUrl('https://bucket.s3-cn-north-1.amazonaws.com.cn/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('fromUrl: bucket-in-host dashed in ap-southeast-1', (t) => {
  const result = s3Urls.fromUrl('https://bucket.s3-ap-southeast-1.amazonaws.com/the/whole/key');
  t.equal(result.Bucket, 'bucket', 'expected bucket');
  t.equal(result.Key, 'the/whole/key', 'expected key');
  t.end();
});

test('convert: in-path to s3', (t) => {
  const result = s3Urls.convert('https://s3.amazonaws.com/bucket/the/whole/key', 's3');
  t.equal(result, 's3://bucket/the/whole/key');
  t.end();
});

test('convert: tileset templates', (t) => {
  t.equal(s3Urls.convert('https://s3.amazonaws.com/bucket/{z}/{x}/{y}', 's3'), 's3://bucket/{z}/{x}/{y}');
  t.end();
});

test('valid', (t) => {
  t.notOk(s3Urls.valid('http://www.google.com'), 'not on s3');
  t.ok(s3Urls.valid('https://s3.amazonaws.com/bucket/the/whole/key'), 'bucket in path');
  t.ok(s3Urls.valid('https://bucket.s3.amazonaws.com/the/whole/key'), 'bucket in host');
  t.ok(s3Urls.valid('http://bucket.s3.amazonaws.com/the/whole/key'), 'http');
  t.ok(s3Urls.valid('s3://bucket/the/whole/key'), 's3');
  t.end();
});
