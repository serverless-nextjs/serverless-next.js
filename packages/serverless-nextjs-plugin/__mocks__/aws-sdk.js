const promisify = mockFunction =>
  mockFunction.mockReturnValue({
    promise: () => Promise.resolve()
  });

const MockCloudWatchLogs = function() {};
function MockEnvironmentCredentials() {}
function MockCloudFormation() {}

const mockDescribeStacks = promisify(jest.fn());
const mockCreateStack = promisify(jest.fn());
const mockDescribeStackEvents = promisify(jest.fn());
const mockDescribeStackResource = promisify(jest.fn());
const mockValidateTemplate = promisify(jest.fn());
const mockUpdateStack = promisify(jest.fn());
const mockListStackResources = promisify(jest.fn());

MockCloudFormation.prototype.describeStacks = mockDescribeStacks;
MockCloudFormation.prototype.createStack = mockCreateStack;
MockCloudFormation.prototype.describeStackEvents = mockDescribeStackEvents;
MockCloudFormation.prototype.describeStackResource = mockDescribeStackResource;
MockCloudFormation.prototype.validateTemplate = mockValidateTemplate;
MockCloudFormation.prototype.updateStack = mockUpdateStack;
MockCloudFormation.prototype.listStackResources = mockListStackResources;

function MockS3() {}

const mockListObjectsV2 = promisify(jest.fn());
const mockUpload = promisify(jest.fn());
MockS3.prototype.listObjectsV2 = mockListObjectsV2;
MockS3.prototype.upload = mockUpload;

const MockSTS = function() {};
const mockGetCallerIdentity = promisify(jest.fn());
MockSTS.prototype.getCallerIdentity = mockGetCallerIdentity;

const MockAPIGateway = function() {};
const mockGetRestApis = promisify(jest.fn());
MockAPIGateway.prototype.getRestApis = mockGetRestApis;

module.exports = {
  EnvironmentCredentials: MockEnvironmentCredentials,
  S3: MockS3,
  CloudFormation: MockCloudFormation,
  CloudWatchLogs: MockCloudWatchLogs,
  STS: MockSTS,
  APIGateway: MockAPIGateway,

  mockDescribeStacks,
  mockCreateStack,
  mockDescribeStackEvents,
  mockDescribeStackResource,
  mockListObjectsV2,
  mockGetCallerIdentity,
  mockUpload,
  mockUpdateStack,
  mockListStackResources,
  mockGetRestApis
};
