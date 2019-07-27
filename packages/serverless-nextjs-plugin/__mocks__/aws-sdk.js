const promisify = mockFunction =>
  mockFunction.mockReturnValue({
    promise: () => Promise.resolve()
  });

function MockEnvironmentCredentials() {}
function MockS3Constructor() {}
function MockCloudFormationConstructor() {}

const mockDescribeStacks = promisify(jest.fn());
const mockCreateStack = promisify(jest.fn());
const mockDescribeStackEvents = promisify(jest.fn());

MockCloudFormationConstructor.prototype.describeStacks = mockDescribeStacks;
MockCloudFormationConstructor.prototype.createStack = mockCreateStack;
MockCloudFormationConstructor.prototype.describeStackEvents = mockDescribeStackEvents;

module.exports = {
  EnvironmentCredentials: MockEnvironmentCredentials,
  S3: MockS3Constructor,
  CloudFormation: MockCloudFormationConstructor,

  mockDescribeStacks,
  mockCreateStack,
  mockDescribeStackEvents
};
