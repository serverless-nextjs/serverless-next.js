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
    [undefined, { defaultMemory: 512, apiMemory: 512 }],
    [{}, { defaultMemory: 512, apiMemory: 512 }],
    [1024, { defaultMemory: 1024, apiMemory: 1024 }],
    [{ defaultLambda: 1024 }, { defaultMemory: 1024, apiMemory: 512 }],
    [{ apiLambda: 2048 }, { defaultMemory: 512, apiMemory: 2048 }],
    [
      { defaultLambda: 128, apiLambda: 2048 },
      { defaultMemory: 128, apiMemory: 2048 }
    ]
  ])("Lambda memory input", (inputMemory, expectedMemory) => {
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
        memory: inputMemory
      });
    });
    it(`sets default lambda memory to ${expectedMemory.defaultMemory} and api lambda memory to ${expectedMemory.apiMemory}`, () => {
      const { defaultMemory, apiMemory } = expectedMemory;

      // Default Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          memory: defaultMemory
        })
      );

      // Api Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          memory: apiMemory
        })
      );
    });
  });

  describe.each([
    [undefined, { defaultTimeout: 10, apiTimeout: 10 }],
    [{}, { defaultTimeout: 10, apiTimeout: 10 }],
    [40, { defaultTimeout: 40, apiTimeout: 40 }],
    [{ defaultLambda: 20 }, { defaultTimeout: 20, apiTimeout: 10 }],
    [{ apiLambda: 20 }, { defaultTimeout: 10, apiTimeout: 20 }],
    [
      { defaultLambda: 15, apiLambda: 20 },
      { defaultTimeout: 15, apiTimeout: 20 }
    ]
  ])("Lambda timeout input", (inputTimeout, expectedTimeout) => {
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
        timeout: inputTimeout
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
    });

    it(`sets default lambda timeout to ${expectedTimeout.defaultTimeout} and api lambda timeout to ${expectedTimeout.apiTimeout}`, () => {
      const { defaultTimeout, apiTimeout } = expectedTimeout;

      // Default Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          timeout: defaultTimeout
        })
      );

      // Api Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          timeout: apiTimeout
        })
      );
    });
  });
});
