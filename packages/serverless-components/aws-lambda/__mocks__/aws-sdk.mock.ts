import { jest } from "@jest/globals";

const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

export const mockCreateFunction = jest.fn();
export const mockCreateFunctionPromise = promisifyMock(mockCreateFunction);

export const mockPublishVersion = jest.fn();
export const mockPublishVersionPromise = promisifyMock(mockPublishVersion);

export const mockGetFunction = jest.fn();
export const mockGetFunctionPromise = promisifyMock(mockGetFunction);

export const mockGetFunctionConfiguration = jest.fn();
export const mockGetFunctionConfigurationPromise = promisifyMock(
  mockGetFunctionConfiguration
);

export const mockUpdateFunctionCode = jest.fn();
export const mockUpdateFunctionCodePromise = promisifyMock(
  mockUpdateFunctionCode
);

export const mockUpdateFunctionConfiguration = jest.fn();
export const mockUpdateFunctionConfigurationPromise = promisifyMock(
  mockUpdateFunctionConfiguration
);

export const mockCreateQueue = jest.fn();
export const mockCreateQueuePromise = promisifyMock(mockCreateQueue);

export const mockGetQueueAttributes = jest.fn();
export const mockGetQueueAttributesPromise = promisifyMock(
  mockGetQueueAttributes
);

export const mockDeleteQueue = jest.fn();
export const mockDeleteQueuePromise = promisifyMock(mockDeleteQueue);

export const mockListEventSourceMappings = jest.fn();
export const mockListEventSourceMappingsPromise = promisifyMock(
  mockListEventSourceMappings
);

export const mockCreateEventSourceMapping = jest.fn();
export const mockCreateEventSourceMappingPromise = promisifyMock(
  mockCreateEventSourceMapping
);

export const mockGetCallerIdentityMapping = jest.fn();
export const mockGetCallerIdentityMappingPromise = promisifyMock(
  mockGetCallerIdentityMapping
);

export const mockListTags = jest.fn();
export const mockListTagsPromise = promisifyMock(mockListTags);
export const mockTagResource = jest.fn();
export const mockTagResourcePromise = promisifyMock(mockTagResource);
export const mockUntagResource = jest.fn();
export const mockUntagResourcePromise = promisifyMock(mockUntagResource);
export const mockListVersionsByFunction = jest.fn();
export const mockListVersionsByFunctionPromise = promisifyMock(
  mockListVersionsByFunction
);
export const mockDeleteFunction = jest.fn();
export const mockDeleteFunctionPromise = promisifyMock(mockDeleteFunction);

export default {
  SQS: jest.fn(() => ({
    createQueue: mockCreateQueue,
    getQueueAttributes: mockGetQueueAttributes,
    deleteQueue: mockDeleteQueue
  })),
  Lambda: jest.fn(() => ({
    listEventSourceMappings: mockListEventSourceMappings,
    createEventSourceMapping: mockCreateEventSourceMapping,
    createFunction: mockCreateFunction,
    publishVersion: mockPublishVersion,
    getFunctionConfiguration: mockGetFunctionConfiguration,
    updateFunctionCode: mockUpdateFunctionCode,
    updateFunctionConfiguration: mockUpdateFunctionConfiguration,
    listTags: mockListTags,
    tagResource: mockTagResource,
    untagResource: mockUntagResource,
    listVersionsByFunction: mockListVersionsByFunction,
    deleteFunction: mockDeleteFunction,
    getFunction: mockGetFunction
  }))
};
