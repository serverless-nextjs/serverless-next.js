const mockCloudFront = jest.fn();
const cloudfront = jest.fn(() => {
  const cloudFront = mockCloudFront;
  cloudFront.init = () => {};
  cloudFront.default = () => {};
  cloudFront.context = {};
  return cloudFront;
});

cloudfront.mockCloudFront = mockCloudFront;

module.exports = cloudfront;
