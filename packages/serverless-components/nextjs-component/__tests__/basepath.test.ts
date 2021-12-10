import path from "path";
import fse from "fs-extra";
import { mockS3 } from "@sls-next/aws-s3";
import { mockCloudFront } from "@sls-next/aws-cloudfront";
import { mockLambda, mockLambdaPublish } from "@sls-next/aws-lambda";
import { mockSQS } from "@sls-next/aws-sqs";
import NextjsComponent from "../src/component";
import { cleanupFixtureDirectory } from "../src/lib/test-utils";

describe("basepath tests", () => {
  let tmpCwd;
  let componentOutputs;
  let consoleWarnSpy;

  const fixturePath = path.join(__dirname, "./fixtures/basepath-app");

  beforeEach(async () => {
    const realFseRemove = fse.remove.bind({});
    jest.spyOn(fse, "remove").mockImplementation((filePath) => {
      // don't delete mocked .next/ files as they're needed for the tests and committed to source control
      if (!filePath.includes(".next" + path.sep)) {
        return realFseRemove(filePath);
      }
    });
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    mockS3.mockResolvedValue({
      name: "bucket-xyz"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:regeneration-cachebehavior-func"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:api-cachebehavior-func"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:image-cachebehavior-func"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:default-cachebehavior-func"
    });
    mockLambdaPublish.mockResolvedValue({
      version: "v1"
    });
    mockCloudFront.mockResolvedValueOnce({
      id: "cloudfrontdistrib",
      url: "https://cloudfrontdistrib.amazonaws.com"
    });
    mockSQS.mockResolvedValue({
      arn: "arn:aws:sqs:us-east-1:123456789012:MyQueue.fifo"
    });

    const component = new NextjsComponent();
    component.context.credentials = {
      aws: {
        accessKeyId: "123",
        secretAccessKey: "456"
      }
    };
    component.context.debug = () => {
      // intentionally empty
    };

    await component.build();

    componentOutputs = await component.deploy();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    fse.remove.mockRestore();
    process.chdir(tmpCwd);
  });

  afterAll(cleanupFixtureDirectory(fixturePath));

  describe("cloudfront", () => {
    it("adds basepath to paths", () => {
      const cloudFrontCreateArgs = mockCloudFront.mock.calls[0][0];
      const pathPatterns = cloudFrontCreateArgs.origins[0].pathPatterns;
      expect(Object.keys(pathPatterns)).toEqual([
        "custom_base/_next/static/*",
        "custom_base/static/*",
        "custom_base/api/*",
        "custom_base/_next/image*",
        "custom_base/_next/data/*"
      ]);
    });
  });
});
