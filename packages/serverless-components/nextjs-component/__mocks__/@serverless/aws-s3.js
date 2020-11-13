const mockS3Upload = jest.fn();
const mockS3 = jest.fn();
const s3 = jest.fn(() => {
  const bucket = mockS3;
  bucket.init = () => {};
  bucket.default = () => {};
  bucket.context = {};
  bucket.upload = mockS3Upload;
  return bucket;
});

s3.mockS3Upload = mockS3Upload;
s3.mockS3 = mockS3;

module.exports = s3;
