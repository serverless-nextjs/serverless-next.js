const path = require("path");
const execa = require("execa");
const { mockDomain } = require("@serverless/domain");
const { mockS3 } = require("@serverless/aws-s3");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const NextjsComponent = require("../serverless");
const obtainDomains = require("../lib/obtainDomains");
const {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} = require("../constants");

jest.mock("execa");

describe("Custom inputs", () => {
  describe.each([
    [["dev", "example.com"], "https://dev.example.com"],
    [["www", "example.com"], "https://www.example.com"],
    [[undefined, "example.com"], "https://www.example.com"],
    [["example.com"], "https://www.example.com"],
    ["example.com", "https://www.example.com"]
  ])("Custom domain", (inputDomains, expectedDomain, memory) => {
    let tmpCwd;
    let componentOutputs;

    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      execa.mockResolvedValueOnce();

      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockS3.mockResolvedValue({
        name: "bucket-xyz"
      });
      mockLambda.mockResolvedValue({
        arn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
      });
      mockLambdaPublish.mockResolvedValue({
        version: "v1"
      });
      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });
      mockDomain.mockResolvedValueOnce({
        domains: [expectedDomain]
      });

      const component = new NextjsComponent();
      componentOutputs = await component.default({
        policy: "arn:aws:iam::aws:policy/CustomRole",
        domain: inputDomains,
        memory: 512
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
    });

    it("uses @serverless/domain to provision custom domain", async () => {
      const { domain, subdomain } = obtainDomains(inputDomains);

      expect(mockDomain).toBeCalledWith({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: {
            url: "https://cloudfrontdistrib.amazonaws.com"
          }
        }
      });
    });

    it("uses custom policy document provided", () => {
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Default Lambda@Edge"),
          role: expect.objectContaining({
            policy: {
              arn: "arn:aws:iam::aws:policy/CustomRole"
            }
          })
        })
      );
    });

    it("outputs custom domain url", async () => {
      expect(componentOutputs.appUrl).toEqual(expectedDomain);
    });
  });

  describe.each([
    [undefined, { defaultMem: 512, apiMem: 512 }],
    [{}, { defaultMem: 512, apiMem: 512 }],
    [1024, { defaultMem: 1024, apiMem: 1024 }],
    [{ defaultLambda: 1024 }, { defaultMem: 1024, apiMem: 512 }],
    [{ apiLambda: 2048 }, { defaultMem: 512, apiMem: 2048 }],
    [{ defaultLambda: 128, apiLambda: 2048 }, { defaultMem: 128, apiMem: 2048 }]
  ])("Custom memory", (memory, expectedMemory) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      execa.mockResolvedValueOnce();

      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });

      const component = new NextjsComponent();
      componentOutputs = await component.default({
        memory
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
    });

    it("uses custom memory", () => {
      const { defaultMem, apiMem } = expectedMemory;

      // Default Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          memory: defaultMem
        })
      );

      // Api Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          memory: apiMem
        })
      );
    });
  });
});
