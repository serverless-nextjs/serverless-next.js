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

const mockGetFunction = jest.fn();
const mockGetFunctionPromise = promisifyMock(mockGetFunction);

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

module.exports = {
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
  mockGetFunction,
  mockGetFunctionPromise,

  Lambda: jest.fn(() => ({
    createFunction: mockCreateFunction,
    publishVersion: mockPublishVersion,
    getFunctionConfiguration: mockGetFunctionConfiguration,
    updateFunctionCode: mockUpdateFunctionCode,
    updateFunctionConfiguration: mockUpdateFunctionConfiguration,
    getFunction: mockGetFunction
  }))
};
