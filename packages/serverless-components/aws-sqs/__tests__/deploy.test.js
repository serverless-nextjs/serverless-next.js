const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const {
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise,
  mockGetCallerIdentityPromise,
  mockGetQueueAttributesPromise,
  mockCreateQueuePromise,
  mockDeleteQueuePromise,
  mockListQueueTagsPromise,
  mockTagQueuePromise,
  mockUntagQueuePromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sqs-aws-sdk.mock"));

describe("sqs component", () => {
  const tmpStateFolder = (initialState) => {
    const dir = fse.mkdtempSync(path.join(os.tmpdir(), "test-sqs-"));
    if (initialState) {
      fse.writeJSONSync(path.join(dir, "TestSqs.json"), initialState);
    }
    return dir;
  };
  mockGetCallerIdentityPromise.mockResolvedValue({ Account: "123" });
  mockGetQueueAttributesPromise.mockResolvedValue({ Attributes: {} });
  mockCreateQueuePromise.mockResolvedValue({ QueueArn: "arn" });

  const AwsSqsQueue = require("../serverless");

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a new queue", async () => {
    const dir = tmpStateFolder();
    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: dir
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
    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder({
        url: "myQueueUrl"
      })
    });
    await component.init();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
  });

  it("creates a queue but does not try to delete an existing queue if none exist already", async () => {
    mockGetQueueAttributesPromise.mockResolvedValueOnce({
      Attributes: { not: "empty" }
    });
    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(0);
  });

  it("does not create a lambda mapping when a mapping is found", async () => {
    mockListEventSourceMappingsPromise.mockResolvedValueOnce({
      EventSourceMappings: [1]
    });
    const component = new AwsSqsQueue("TestSqs", {
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
    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.addEventSource("arn");
    expect(mockCreateEventSourceMappingPromise).toBeCalledTimes(1);
  });

  it("calls the delete handler when component is deleted", async () => {
    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.remove();
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
  });

  it("configures queue tags when tags are different", async () => {
    mockListQueueTagsPromise.mockResolvedValueOnce({
      Tags: {
        c: "d"
      }
    });

    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default({ tags: { a: "b" } });

    expect(mockListQueueTagsPromise).toBeCalledTimes(1);
    expect(mockTagQueuePromise).toBeCalledTimes(1);
    expect(mockUntagQueuePromise).toBeCalledTimes(1);
  });

  it("does not configure queue tags when tags are the same", async () => {
    mockListQueueTagsPromise.mockResolvedValueOnce({
      Tags: {
        a: "b"
      }
    });

    const component = new AwsSqsQueue("TestSqs", {
      stateRoot: tmpStateFolder()
    });
    await component.init();
    await component.default({ tags: { a: "b" } });

    expect(mockListQueueTagsPromise).toBeCalledTimes(1);
    expect(mockTagQueuePromise).not.toBeCalled();
    expect(mockUntagQueuePromise).not.toBeCalled();
  });
});
