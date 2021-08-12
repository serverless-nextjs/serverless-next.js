import {
  mockListEventSourceMappingsPromise,
  mockCreateEventSourceMappingPromise,
  mockGetCallerIdentityPromise,
  mockGetQueueAttributesPromise,
  mockCreateQueuePromise,
  mockDeleteQueuePromise,
  mockListQueueTagsPromise,
  mockTagQueuePromise,
  mockUntagQueuePromise
} from "../__mocks__/aws-sqs-aws-sdk.mock";
import { createComponent } from "../test-utils";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sqs-aws-sdk.mock"));

describe("sqs component", () => {
  mockGetCallerIdentityPromise.mockResolvedValue({ Account: "123" });
  mockGetQueueAttributesPromise.mockResolvedValue({ Attributes: {} });
  mockCreateQueuePromise.mockResolvedValue({ QueueArn: "arn" });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a new queue", async () => {
    const component = await createComponent();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(0);
  });

  it("deletes and recreates a queue", async () => {
    mockGetQueueAttributesPromise.mockResolvedValueOnce({
      Attributes: { not: "empty" }
    });
    const component = await createComponent("myQueueUrl");
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
  });

  it("creates a queue but does not try to delete an existing queue if none exist already", async () => {
    mockGetQueueAttributesPromise.mockResolvedValueOnce({
      Attributes: { not: "empty" }
    });
    const component = await createComponent();
    await component.default();
    expect(mockCreateQueuePromise).toBeCalledTimes(1);
    expect(mockDeleteQueuePromise).toBeCalledTimes(0);
  });

  it("does not create a lambda mapping when a mapping is found", async () => {
    mockListEventSourceMappingsPromise.mockResolvedValueOnce({
      EventSourceMappings: [1]
    });
    const component = await createComponent();
    await component.default();
    await component.addEventSource("arn");
    expect(mockCreateEventSourceMappingPromise).toBeCalledTimes(0);
  });

  it("creates lambda mapping when no mapping is found", async () => {
    mockListEventSourceMappingsPromise.mockResolvedValueOnce({
      EventSourceMappings: []
    });
    const component = await createComponent();
    await component.default();
    await component.addEventSource("arn");
    expect(mockCreateEventSourceMappingPromise).toBeCalledTimes(1);
  });

  it("calls the delete handler when component is deleted", async () => {
    const component = await createComponent();
    await component.default();
    await component.remove();
    expect(mockDeleteQueuePromise).toBeCalledTimes(1);
  });

  it("configures queue tags when tags are different", async () => {
    mockListQueueTagsPromise.mockResolvedValueOnce({
      Tags: {
        c: "d"
      }
    });

    const component = await createComponent();
    // @ts-ignore
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

    const component = await createComponent();
    // @ts-ignore
    await component.default({ tags: { a: "b" } });

    expect(mockListQueueTagsPromise).toBeCalledTimes(1);
    expect(mockTagQueuePromise).not.toBeCalled();
    expect(mockUntagQueuePromise).not.toBeCalled();
  });
});
