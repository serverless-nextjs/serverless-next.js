import { jest } from "@jest/globals";

import {
  mockSend,
  mockDeleteObjectCommand
} from "../mocks/s3/aws-sdk-s3-client.mock2";
import { s3RemovePage } from "../../src/s3/s3RemovePage";

jest.mock("@aws-sdk/client-s3", () =>
  require("../mocks/s3/aws-sdk-s3-client.mock2")
);

describe("S3DeletePage Tests", () => {
  it.each`
    basePath       | uri          | expectedKeyName
    ${undefined}   | ${"/custom"} | ${"custom"}
    ${undefined}   | ${"/"}       | ${"index"}
    ${"/basepath"} | ${"/custom"} | ${"custom"}
    ${"/basepath"} | ${"/"}       | ${"index"}
  `(
    "should delete the page with basePath $basePath at path $uri with expectedKeyName $expectedKeyName",
    async ({ basePath, uri, expectedKeyName }) => {
      await s3RemovePage({
        uri: uri,
        basePath: basePath,
        bucketName: "test",
        buildId: "test-build-id",
        region: "us-east-1"
      });

      const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";

      expect(mockDeleteObjectCommand).toHaveBeenNthCalledWith(1, {
        Bucket: "test",
        Key: `${s3BasePath}_next/data/test-build-id/${expectedKeyName}.json`
      });

      expect(mockDeleteObjectCommand).toHaveBeenNthCalledWith(2, {
        Bucket: "test",
        Key: `${s3BasePath}static-pages/test-build-id/${expectedKeyName}.html`
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
    }
  );
});
