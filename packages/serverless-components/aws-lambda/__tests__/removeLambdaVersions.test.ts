import {
  mockGetFunctionConfigurationPromise,
  mockListVersionsByFunctionPromise,
  mockGetFunctionConfiguration,
  mockListVersionsByFunction,
  mockDeleteFunction,
  mockDeleteFunctionPromise
} from "../__mocks__/aws-sdk.mock";
import { removeLambdaVersions } from "../src/removeLambdaVersions";
import { jest } from "@jest/globals";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("publishVersion", () => {
  it("removes all old lambda versions", async () => {
    mockGetFunctionConfigurationPromise.mockResolvedValue({
      FunctionName: "test-function",
      Version: "4"
    });

    mockListVersionsByFunctionPromise.mockResolvedValue({
      Versions: [
        {
          FunctionName: "test-function",
          Version: "1"
        },
        {
          FunctionName: "test-function",
          Version: "2"
        },
        {
          FunctionName: "test-function",
          Version: "3"
        },
        {
          FunctionName: "test-function",
          Version: "4"
        }
      ]
    });

    mockDeleteFunctionPromise.mockResolvedValueOnce(undefined);
    mockDeleteFunctionPromise.mockResolvedValueOnce(undefined);
    // Simulate last function couldn't be deleted, but it will not fail the process.
    mockDeleteFunctionPromise.mockRejectedValueOnce({
      message: "Mocked error"
    });

    await removeLambdaVersions(
      {
        debug: () => {
          // intentionally empty
        }
      },
      "test-function",
      "us-east-1"
    );

    expect(mockDeleteFunction).toBeCalledWith({
      FunctionName: "test-function",
      Qualifier: "1"
    });

    expect(mockDeleteFunction).toBeCalledWith({
      FunctionName: "test-function",
      Qualifier: "2"
    });

    expect(mockDeleteFunction).toBeCalledWith({
      FunctionName: "test-function",
      Qualifier: "3"
    });

    expect(mockDeleteFunction).toBeCalledTimes(3);

    expect(mockGetFunctionConfiguration).toBeCalledWith({
      FunctionName: "test-function"
    });
    expect(mockGetFunctionConfiguration).toBeCalledTimes(1);

    expect(mockListVersionsByFunction).toBeCalledWith({
      FunctionName: "test-function",
      MaxItems: 50
    });
    expect(mockListVersionsByFunction).toBeCalledTimes(1);
  });
});
