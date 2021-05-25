const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const {
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise,
  mockGetCallerIdentityPromise,
  mockGetQueueAttributesPromise,
  mockCreateQueuePromise,
  mockDeleteQueuePromise
} = require("aws-sdk");

describe("sqs component", () => {
  const tmpStateFolder = () => fse.mkdtempSync(path.join(os.tmpdir(), "test-"));
  mockGetCallerIdentityPromise.mockResolvedValue({ Account: "123" });
  mockGetQueueAttributesPromise.mockResolvedValue({ Attributes: {} });
  mockCreateQueuePromise.mockResolvedValue({ QueueArn: "arn" });

  const AwsSqsQueue = require("../serverless");

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a new queue", async () => {
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(0);
  });

  it("deletes and recreates a queue", async () => {
    mockGetQueueAttributesPromise.mockResolvedValueOnce({
      Attributes: { not: "empty" }
    });
    const component = new AwsSqsQueue("TestLambda", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
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
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
  });
});
