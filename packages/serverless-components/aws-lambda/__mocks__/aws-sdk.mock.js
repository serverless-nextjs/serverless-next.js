const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

const mockCreateFunction = jest.fn();
const mockCreateFunctionPromise = promisifyMock(mockCreateFunction);

const mockPublishVersion = jest.fn();
const mockPublishVersionPromise = promisifyMock(mockPublishVersion);

const mockGetFunctionConfiguration = jest.fn();
const mockGetFunctionConfigurationPromise = promisifyMock(
  mockGetFunctionConfiguration
);

const mockUpdateFunctionCode = jest.fn();
const mockUpdateFunctionCodePromise = promisifyMock(mockUpdateFunctionCode);

const mockUpdateFunctionConfiguration = jest.fn();
const mockUpdateFunctionConfigurationPromise = promisifyMock(
  mockUpdateFunctionConfiguration
);

const mockCreateQueue = jest.fn();
const mockCreateQueuePromise = promisifyMock(mockCreateQueue);

const mockGetQueueAttributes = jest.fn();
const mockGetQueueAttributesPromise = promisifyMock(mockGetQueueAttributes);

const mockDeleteQueue = jest.fn();
const mockDeleteQueuePromise = promisifyMock(mockDeleteQueue);

const mockListEventSourceMappings = jest.fn();
const mockListEventSourceMappingsPromise = promisifyMock(
  mockListEventSourceMappings
);

const mockCreateEventSourceMapping = jest.fn();
const mockCreateEventSourceMappingPromise = promisifyMock(
  mockCreateEventSourceMapping
);

const mockGetCallerIdentityMapping = jest.fn();
const mockGetCallerIdentityMappingPromise = promisifyMock(
  mockGetCallerIdentityMapping
);

module.exports = {
  mockCreateQueuePromise,
  mockGetQueueAttributesPromise,
  mockDeleteQueuePromise,
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise,
  mockCreateQueue,
  mockGetQueueAttributes,
  mockDeleteQueue,
  mockListEventSourceMappings,
  mockCreateEventSourceMapping,
  mockGetCallerIdentityMappingPromise,
  mockGetCallerIdentityMapping,

  SQS: jest.fn(() => ({
    createQueue: mockCreateQueue,
    getQueueAttributes: mockGetQueueAttributes,
    deleteQueue: mockDeleteQueue
  })),

  mockCreateFunction,
  mockCreateFunctionPromise,
  mockPublishVersion,
  mockPublishVersionPromise,
  mockGetFunctionConfiguration,
  mockGetFunctionConfigurationPromise,
  mockUpdateFunctionCode,
  mockUpdateFunctionCodePromise,
  mockUpdateFunctionConfiguration,
  mockUpdateFunctionConfigurationPromise,

  Lambda: jest.fn(() => ({
    listEventSourceMappings: mockListEventSourceMappings,
    createEventSourceMapping: mockCreateEventSourceMapping,
    createFunction: mockCreateFunction,
    publishVersion: mockPublishVersion,
    getFunctionConfiguration: mockGetFunctionConfiguration,
    updateFunctionCode: mockUpdateFunctionCode,
    updateFunctionConfiguration: mockUpdateFunctionConfiguration
  }))
};
