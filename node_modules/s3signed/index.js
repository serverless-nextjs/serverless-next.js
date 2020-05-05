var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var url = require('url');

module.exports = function(s3url, expires, callback) {
  s3.config.getCredentials(function(err) {
    if (err) return callback(new Error(err.code));

    var uri = url.parse(s3url);
    if (uri.protocol !== 's3:')
      return callback(new Error('Provide a valid S3 url'));

      var params = {
        Bucket: uri.hostname,
        Key: uri.pathname.slice(1),
        Expires: Number(expires)
      };

      s3.getSignedUrl('getObject', params, function(err, signedUrl) {
        if (err) return callback(err);
        callback(null, signedUrl);
      });
  });
};
