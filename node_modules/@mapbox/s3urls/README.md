# s3Urls

[![Build Status](https://travis-ci.org/mapbox/s3urls.svg?branch=node-4)](https://travis-ci.org/mapbox/s3urls)

From bucket/key to URL and the other way around

## Usage

In javascript:

```javascript
var s3urls = require('@mapbox/s3urls');
var assert = require('assert');

var url = s3urls.toUrl('my-bucket', 'some/key');
assert.deepEqual(url, {
  's3': 's3://my-bucket/some/key',
  'bucket-in-path': 'https://s3.amazonaws.com/my-bucket/some/key',
  'bucket-in-host': 'https://my-bucket.s3.amazonaws.com/some/key'
});

var url = 'https://s3.amazonaws.com/my-bucket/some/key';
if (s3urls.valid(url)) {
  var result = s3urls.fromUrl(url);
  assert.deepEqual(result, {
    Bucket: 'my-bucket',
    Key: 'some/key'
  });
}
```

In a shell:

```sh
$ npm install -g @mapbox/s3urls

# Get URLs for a bucket/key
$ s3urls to-url my-bucket some/file/key
s3://my-bucket/some/file/key
https://s3.amazonaws.com/my-bucket/some/file/key
https://my-bucket.s3.amazonaws.com/some/file/key

# Get one type of URL for a bucket/key
$ s3urls to-url my-bucket some/file/key --type bucket-in-host
https://my-bucket.s3.amazonaws.com/some/file/key

# Convert a URL from one type to another (defaults to bucket-in-host type)
$ s3urls convert s3://my-bucket/some/file/key
https://my-bucket.s3.amazonaws.com/some/file/key

$ s3urls convert https://my-bucket.s3.amazonaws.com/some/file/key --type s3
s3://my-bucket/some/file/key

# Get a signed URL for a private object (default 600s expiration)
$ s3urls signed my-bucket some/file/key
https://my-bucket.s3.amazonaws.com/some/file/key?...

$ s3urls signed s3://my-bucket/some/file/key --expire 1200
https://my-bucket.s3.amazonaws.com/some/file/key?...
```
