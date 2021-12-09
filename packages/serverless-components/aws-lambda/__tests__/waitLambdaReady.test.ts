import {
  mockGetFunctionPromise,
  mockGetFunction
} from "../__mocks__/aws-sdk.mock";
import { waitUntilReady } from "../src/waitUntilReady";
import { jest } from "@jest/globals";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("waitLambdaReady", () => {
  it("waits until lambda is ready", async () => {
    mockGetFunctionPromise.mockResolvedValueOnce({
      Configuration: {
        State: "Pending",
        LastUpdateStatus: "InProgress"
      }
    });

    mockGetFunctionPromise.mockResolvedValueOnce({
      Configuration: {
        State: "Active",
        LastUpdateStatus: "Successful"
      }
    });

    const ready = await waitUntilReady(
      {
        debug: () => {
          // intentionally empty
        }
      },
      "test-function",
      "us-east-1",
      1
    );

    expect(ready).toBe(true);

    expect(mockGetFunction).toBeCalledWith({
      FunctionName: "test-function"
    });
    expect(mockGetFunction).toBeCalledTimes(2); // since first time it's mocked as not ready
  });
});
