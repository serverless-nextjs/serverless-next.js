const mockCreateInvalidation = jest.fn();
const mockCheckCloudFrontDistributionReady = jest.fn();

module.exports = {
  mockCreateInvalidation,
  mockCheckCloudFrontDistributionReady,
  checkCloudFrontDistributionReady: mockCheckCloudFrontDistributionReady,
  createInvalidation: mockCreateInvalidation
};
