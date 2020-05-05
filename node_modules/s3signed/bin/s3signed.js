#!/usr/bin/env node

var s3signed = require('..');

var args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: signed <s3url> [seconds until expire]');
  process.exit(1);
}

s3signed(args[0], args[1], function(err, signedUrl) {
  if (err) return console.error(err);
  console.log(signedUrl);
});
