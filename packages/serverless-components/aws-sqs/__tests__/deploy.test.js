const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const {
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise
} = require("aws-sdk");

describe("sqs component", () => {
  const mockCreateQueue = jest.fn();
  const mockDeleteQueue = jest.fn();
  const mockGetDefaults = jest.fn();
  const mockGetQueue = jest.fn();
  const mockGetAccountId = jest.fn();
  const mockGetArn = jest.fn();
  const mockGetUrl = jest.fn();
  const mockSetAttributes = jest.fn();
  jest.mock("../utils", () => ({
    createQueue: mockCreateQueue,
    deleteQueue: mockDeleteQueue,
    getDefaults: mockGetDefaults,
    getQueue: mockGetQueue,
    getAccountId: mockGetAccountId,
    getArn: mockGetArn,
    getUrl: mockGetUrl,
    setAttributes: mockSetAttributes
  }));
  const tmpStateFolder = () => fse.mkdtempSync(path.join(os.tmpdir(), "test-"));

  const AwsSqsQueue = require("../serverless");

  it("creates a new queue", async () => {
    mockGetQueue.mockReturnValueOnce({});
    mockGetAccountId.mockResolvedValueOnce("id");
    mockGetArn.mockResolvedValueOnce("arn");
    mockGetUrl.mockResolvedValueOnce("url");
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueue).toBeCalledTimes(1);
    expect(mockDeleteQueue).toBeCalledTimes(0);
  });

  it("deletes and recreates a queue", async () => {
    mockGetQueue.mockReturnValueOnce({ not: "empty" });
    mockGetAccountId.mockResolvedValueOnce("id");
    mockGetArn.mockResolvedValueOnce("arn");
    mockGetUrl.mockResolvedValueOnce("url");
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueue).toBeCalledTimes(1);
    expect(mockDeleteQueue).toBeCalledTimes(1);
  });

  it("updates an existing queue", async () => {
    mockGetQueue.mockReturnValueOnce({ not: "empty" });
    mockGetAccountId.mockResolvedValueOnce("id");
    mockGetArn.mockResolvedValueOnce("arn");
    mockGetUrl.mockReturnValueOnce(undefined);
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueue).toBeCalledTimes(0);
    expect(mockSetAttributes).toBeCalledTimes(1);
    expect(mockDeleteQueue).toBeCalledTimes(0);
  });

  it("does not create a lambda mapping when a mapping is found", async () => {
    mockListEventSourceMappingsPromise.mockResolvedValueOnce({
      EventSourceMappings: [1]
    });
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.addEventSource("arn");
    expect(mockCreateEventSourceMappingPromise).toBeCalledTimes(0);
  });

  it("creates lambda mapping when no mapping is found", async () => {
    mockListEventSourceMappingsPromise.mockResolvedValueOnce({
      EventSourceMappings: []
    });
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.addEventSource("arn");
    expect(mockCreateEventSourceMappingPromise).toBeCalledTimes(1);
  });

  it("calls the delete handler when component is deleted", async () => {
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.remove();
    expect(mockDeleteQueue).toBeCalledTimes(1);
  });
});
