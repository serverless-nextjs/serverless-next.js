import { createComponent, createTmpDir } from "../test-utils";

import {
  mockCreateFunction,
  mockCreateFunctionPromise,
  mockGetFunction,
  mockGetFunctionPromise,
  mockPublishVersion,
  mockPublishVersionPromise,
  mockGetFunctionConfigurationPromise,
  mockUpdateFunctionCodePromise,
  mockUpdateFunctionConfigurationPromise,
  mockListTags,
  mockListTagsPromise,
  mockTagResource,
  mockUntagResource
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

const mockIamRole = jest.fn();
jest.mock("@serverless/aws-iam-role", () =>
  jest.fn(() => {
    const iamRole: any = mockIamRole;
    iamRole.init = () => {
      // intentional
    };
    iamRole.default = () => {
      // intentional
    };
    iamRole.context = {};
    return iamRole;
  })
);

require("@serverless/aws-iam-role");

describe("publishVersion", () => {
  let component;

  beforeEach(async () => {
    mockIamRole.mockResolvedValue({
      arn: "arn:aws:iam::123456789012:role/xyz"
    });
    mockCreateFunctionPromise.mockResolvedValueOnce({
      FunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:my-func",
      CodeSha256: "LQT0VA="
    });
    mockGetFunctionPromise.mockResolvedValue({
      Configuration: {
        State: "Active",
        LastUpdateStatus: "Successful"
      }
    });

    component = await createComponent();
  });

  it("publishes new version of lambda that was created", async () => {
    mockGetFunctionConfigurationPromise.mockRejectedValueOnce({
      code: "ResourceNotFoundException"
    });
    mockPublishVersionPromise.mockResolvedValueOnce({
      Version: "v2"
    });
    const tmpFolder = await createTmpDir();

    await component.default({
      code: tmpFolder,
      tags: { new: "tag" }
    });

    const versionResult = await component.publishVersion();

    expect(mockPublishVersion).toBeCalledWith({
      FunctionName: expect.any(String),
      CodeSha256: "LQT0VA="
    });

    expect(versionResult).toEqual({
      version: "v2"
    });

    expect(mockCreateFunction).toBeCalledWith(
      expect.objectContaining({
        Tags: { new: "tag" }
      })
    );
  });

  it("publishes new version of lambda that was updated", async () => {
    mockPublishVersionPromise.mockResolvedValue({
      Version: "v2"
    });
    mockGetFunctionConfigurationPromise.mockRejectedValueOnce({
      code: "ResourceNotFoundException"
    });
    mockGetFunctionConfigurationPromise.mockResolvedValueOnce({
      FunctionName: "my-func"
    });
    mockUpdateFunctionCodePromise.mockResolvedValueOnce({
      FunctionName: "my-func"
    });
    mockCreateFunctionPromise.mockResolvedValueOnce({
      CodeSha256: "LQT0VA="
    });
    mockUpdateFunctionConfigurationPromise.mockResolvedValueOnce({
      CodeSha256: "XYZ0VA=",
      FunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
    });
    mockListTagsPromise.mockResolvedValueOnce({
      Tags: { foo: "bar" }
    });

    const tmpFolder = await createTmpDir();

    await component.default({
      code: tmpFolder
    });

    await component.default({
      code: tmpFolder,
      tags: { new: "tag" }
    });

    const versionResult = await component.publishVersion();

    expect(mockPublishVersion).toBeCalledWith({
      FunctionName: expect.any(String),
      CodeSha256: "XYZ0VA=" // compare against the hash received from the function update, *not* create
    });

    expect(mockListTags).toBeCalledWith({
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
    });

    expect(mockUntagResource).toBeCalledWith({
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:my-func",
      TagKeys: ["foo"]
    });

    expect(mockTagResource).toBeCalledWith({
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:my-func",
      Tags: { new: "tag" }
    });

    expect(versionResult).toEqual({
      version: "v2"
    });
  });
});
