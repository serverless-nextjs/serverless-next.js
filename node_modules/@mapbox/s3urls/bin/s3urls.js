#!/usr/bin/env node

var s3urls = require('..');

var argv = require('minimist')(process.argv.slice(2));

function usage() {
  console.log('s3urls from-url <url>');
  console.log('s3urls to-url <bucket> <key> [--type [s3|bucket-in-path|bucket-in-host]]');
  console.log('s3urls convert <url> [--type [s3|bucket-in-path|bucket-in-host]]');
  console.log('s3urls signed <url> | <bucket> <key> [--expire <seconds>]');
}

function fail(msg) {
  console.error(msg);
  usage();
  process.exit(1);
}

var command = argv._[0];
if (['to-url','from-url', 'convert', 'signed'].indexOf(command) === -1)
  return fail('ERROR: Invalid command');

if (command === 'from-url') {
  var url = argv._[1];
  if (!url) return fail('ERROR: No url given');

  var result = s3urls.fromUrl(url);
  if (!result.Bucket || !result.Key) return fail('ERROR: Unrecognizable S3 url');

  console.log(JSON.stringify(result));
}

if (command === 'to-url') {
  var bucket = argv._[1];
  var key = argv._[2];

  if (!bucket || !key) return fail('ERROR: Must specify bucket and key');

  var result = s3urls.toUrl(bucket, key);
  if (argv.type) return console.log(result[argv.type]);

  for (var k in result) {
    console.log(result[k]);
  }
}

if (command === 'convert') {
  var url = argv._[1];
  if (!url) return fail('ERROR: No url given');
  argv.type = argv.type || 'bucket-in-host';

  var check = s3urls.fromUrl(url);
  if (!check.Bucket || !check.Key) return fail('ERROR: Unrecognizable S3 url');

  console.log(s3urls.convert(url, argv.type));
}

if (command === 'signed') {
  url = argv._.length > 2 ?
    s3urls.toUrl(argv._[1], argv._[2]).s3 :
    s3urls.convert(argv._[1], 's3');

  s3urls.signed(url, argv.expire || 600, function(err, signedUrl) {
    if (err) return console.error(err);
    console.log(signedUrl);
  });
}
