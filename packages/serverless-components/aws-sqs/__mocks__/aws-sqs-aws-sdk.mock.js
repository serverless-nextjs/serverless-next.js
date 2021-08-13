const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

export const mockGetCallerIdentity = jest.fn();
export const mockGetCallerIdentityPromise = promisifyMock(
  mockGetCallerIdentity
);

export const mockGetQueueAttributes = jest.fn();
export const mockGetQueueAttributesPromise = promisifyMock(
  mockGetQueueAttributes
);

export const mockCreateQueue = jest.fn();
export const mockCreateQueuePromise = promisifyMock(mockCreateQueue);

export const mockDeleteQueue = jest.fn();
export const mockDeleteQueuePromise = promisifyMock(mockDeleteQueue);

export const mockListQueueTags = jest.fn();
export const mockListQueueTagsPromise = promisifyMock(mockListQueueTags);

export const mockTagQueue = jest.fn();
export const mockTagQueuePromise = promisifyMock(mockTagQueue);

export const mockUntagQueue = jest.fn();
export const mockUntagQueuePromise = promisifyMock(mockUntagQueue);

export const mockListEventSourceMappings = jest.fn();
export const mockListEventSourceMappingsPromise = promisifyMock(
  mockListEventSourceMappings
);

export const mockCreateEventSourceMapping = jest.fn();
export const mockCreateEventSourceMappingPromise = promisifyMock(
  mockCreateEventSourceMapping
);

module.exports = {
  SQS: jest.fn(() => ({
    createQueue: mockCreateQueue,
    deleteQueue: mockDeleteQueue,
    getQueueAttributes: mockGetQueueAttributes,
    listQueueTags: mockListQueueTags,
    tagQueue: mockTagQueue,
    untagQueue: mockUntagQueue
  })),
  STS: jest.fn(() => ({
    getCallerIdentity: mockGetCallerIdentity
  })),
  SharedIniFileCredentials: jest.fn(),
  Lambda: jest.fn(() => ({
    listEventSourceMappings: mockListEventSourceMappings,
    createEventSourceMapping: mockCreateEventSourceMapping
  })),
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise,
  mockGetCallerIdentityPromise,
  mockGetQueueAttributesPromise,
  mockCreateQueuePromise,
  mockDeleteQueuePromise,
  mockListQueueTagsPromise,
  mockTagQueuePromise,
  mockUntagQueuePromise
};
