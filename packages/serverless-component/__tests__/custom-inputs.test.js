const fse = require("fs-extra");
const path = require("path");
const { mockDomain } = require("@serverless/domain");
const { mockS3 } = require("@serverless/aws-s3");
const { mockUpload } = require("aws-sdk");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const NextjsComponent = require("../serverless");
const obtainDomains = require("../lib/obtainDomains");
const {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} = require("../constants");

const createNextComponent = inputs => {
  const component = new NextjsComponent(inputs);
  component.context.credentials = {
    aws: {
      accessKeyId: "123",
      secretAccessKey: "456"
    }
  };
  return component;
};

describe("Custom inputs", () => {
  let tmpCwd;
  let componentOutputs;
  let consoleWarnSpy;

  beforeEach(() => {
    // mock out remove to prevent fixture files from being wiped out
    jest.spyOn(fse, "remove").mockImplementation(() => {
      return;
    });
    jest.spyOn(fse, "emptyDir").mockImplementation(() => {
      return;
    });

    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    fse.remove.mockRestore();
    fse.emptyDir.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe.each`
    inputDomains                  | expectedDomain
    ${["dev", "example.com"]}     | ${"https://dev.example.com"}
    ${["www", "example.com"]}     | ${"https://www.example.com"}
    ${"example.com"}              | ${"https://www.example.com"}
    ${[undefined, "example.com"]} | ${"https://www.example.com"}
    ${"example.com"}              | ${"https://www.example.com"}
  `("Custom domain", ({ inputDomains, expectedDomain }) => {
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
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

      const component = createNextComponent();

      componentOutputs = await component.default({
        policy: "arn:aws:iam::aws:policy/CustomRole",
        domain: inputDomains,
        description: "Custom description",
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
          description: expect.stringContaining("Custom description"),
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

  describe.each`
    nextConfigDir      | nextStaticDir      | fixturePath
    ${"nextConfigDir"} | ${"nextStaticDir"} | ${path.join(__dirname, "./fixtures/split-app")}
  `(
    "nextConfigDir=$nextConfigDir, nextStaticDir=$nextStaticDir",
    ({ fixturePath, ...inputs }) => {
      beforeEach(async () => {
        process.chdir(fixturePath);

        mockS3.mockResolvedValue({
          name: "bucket-xyz"
        });

        mockCloudFront.mockResolvedValueOnce({
          url: "https://cloudfrontdistrib.amazonaws.com"
        });

        mockLambda.mockResolvedValue({
          arn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
        });
        mockLambdaPublish.mockResolvedValue({
          version: "v1"
        });
        const component = createNextComponent();

        componentOutputs = await component.default({
          nextConfigDir: inputs.nextConfigDir,
          nextStaticDir: inputs.nextStaticDir
        });
      });

      it("uploads static assets to S3 correctly", () => {
        expect(mockUpload).toBeCalledWith(
          expect.objectContaining({
            Key: expect.stringMatching(
              "_next/static/test-build-id/placeholder.js"
            )
          })
        );
        expect(mockUpload).toBeCalledWith(
          expect.objectContaining({
            Key: expect.stringMatching("static-pages/terms.html")
          })
        );
        expect(mockUpload).toBeCalledWith(
          expect.objectContaining({
            Key: expect.stringMatching("static/donotdelete.txt")
          })
        );
        expect(mockUpload).toBeCalledWith(
          expect.objectContaining({
            Key: expect.stringMatching("public/favicon.ico")
          })
        );
      });
    }
  );

  describe.each`
    inputMemory                                | expectedMemory
    ${undefined}                               | ${{ defaultMemory: 512, apiMemory: 512 }}
    ${1024}                                    | ${{ defaultMemory: 1024, apiMemory: 1024 }}
    ${{ defaultLambda: 1024 }}                 | ${{ defaultMemory: 1024, apiMemory: 512 }}
    ${{}}                                      | ${{ defaultMemory: 512, apiMemory: 512 }}
    ${{ apiLambda: 2048 }}                     | ${{ defaultMemory: 512, apiMemory: 2048 }}
    ${{ defaultLambda: 128, apiLambda: 2048 }} | ${{ defaultMemory: 128, apiMemory: 2048 }}
    ${{ defaultLambda: 1024 }}                 | ${{ defaultMemory: 1024, apiMemory: 512 }}
  `("Lambda memory input", ({ inputMemory, expectedMemory }) => {
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      process.chdir(fixturePath);

      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });

      const component = createNextComponent({
        memory: inputMemory
      });

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

  describe.each`
    inputTimeout                            | expectedTimeout
    ${undefined}                            | ${{ defaultTimeout: 10, apiTimeout: 10 }}
    ${{}}                                   | ${{ defaultTimeout: 10, apiTimeout: 10 }}
    ${40}                                   | ${{ defaultTimeout: 40, apiTimeout: 40 }}
    ${{ defaultLambda: 20 }}                | ${{ defaultTimeout: 20, apiTimeout: 10 }}
    ${{ apiLambda: 20 }}                    | ${{ defaultTimeout: 10, apiTimeout: 20 }}
    ${{ defaultLambda: 15, apiLambda: 20 }} | ${{ defaultTimeout: 15, apiTimeout: 20 }}
  `("Input timeout options", ({ inputTimeout, expectedTimeout }) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });

      const component = createNextComponent();

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

  describe.each`
    inputName                                                     | expectedName
    ${undefined}                                                  | ${{ defaultName: undefined, apiName: undefined }}
    ${{}}                                                         | ${{ defaultName: undefined, apiName: undefined }}
    ${"fooFunction"}                                              | ${{ defaultName: "fooFunction", apiName: "fooFunction" }}
    ${{ defaultLambda: "fooFunction" }}                           | ${{ defaultName: "fooFunction", apiName: undefined }}
    ${{ apiLambda: "fooFunction" }}                               | ${{ defaultName: undefined, apiName: "fooFunction" }}
    ${{ defaultLambda: "fooFunction", apiLambda: "barFunction" }} | ${{ defaultName: "fooFunction", apiName: "barFunction" }}
  `("Lambda name input", ({ inputName, expectedName }) => {
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      process.chdir(fixturePath);

      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });

      const component = createNextComponent();

      componentOutputs = await component.default({
        name: inputName
      });
    });
    it(`sets default lambda name to ${expectedName.defaultName} and api lambda name to ${expectedName.apiName}`, () => {
      const { defaultName, apiName } = expectedName;

      // Default Lambda
      const expectedDefaultObject = {
        code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR)
      };
      if (defaultName) expectedDefaultObject.name = defaultName;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining(expectedDefaultObject)
      );

      // Api Lambda
      const expectedApiObject = {
        code: path.join(fixturePath, API_LAMBDA_CODE_DIR)
      };
      if (apiName) expectedApiObject.name = apiName;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining(expectedApiObject)
      );
    });
  });

  describe.each([
    // no input
    [undefined, {}],
    // empty input
    [{}, {}],
    // ignores origin-request and origin-response triggers as they're reserved by serverless-next.js
    [
      {
        defaults: {
          ttl: 500,
          "lambda@edge": {
            "origin-request": "ignored",
            "origin-response": "also ignored"
          }
        }
      },
      { defaults: { ttl: 500 } }
    ],
    // allow lamdba@edge triggers other than origin-request and origin-response
    [
      {
        defaults: {
          ttl: 500,
          "lambda@edge": {
            "viewer-request": "used value"
          }
        }
      },
      {
        defaults: {
          ttl: 500,
          "lambda@edge": { "viewer-request": "used value" }
        }
      }
    ],
    [
      { defaults: { forward: { headers: "X" } } },
      { defaults: { forward: { headers: "X" } } }
    ],
    // ignore custom lambda@edge origin-request trigger set on the api cache behaviour
    [
      {
        "api/*": {
          ttl: 500,
          "lambda@edge": { "origin-request": "ignored value" }
        }
      },
      { "api/*": { ttl: 500 } }
    ],
    // allow other lambda@edge triggers on the api cache behaviour
    [
      {
        "api/*": {
          ttl: 500,
          "lambda@edge": { "origin-response": "used value" }
        }
      },
      {
        "api/*": {
          ttl: 500,
          "lambda@edge": { "origin-response": "used value" }
        }
      }
    ],
    // custom origins and expanding relative URLs to full S3 origin
    [
      {
        origins: [
          "http://some-origin",
          "/relative",
          { url: "http://diff-origin" },
          { url: "/diff-relative" }
        ]
      },
      {
        origins: [
          "http://some-origin",
          "http://bucket-xyz.s3.amazonaws.com/relative",
          { url: "http://diff-origin" },
          { url: "http://bucket-xyz.s3.amazonaws.com/diff-relative" }
        ]
      }
    ],
    // custom page cache behaviours
    [
      {
        "/terms": {
          ttl: 5500,
          "misc-param": "misc-value",
          "lambda@edge": {
            "origin-request": "ignored value"
          }
        }
      },
      {
        "/terms": {
          ttl: 5500,
          "misc-param": "misc-value"
        }
      }
    ],
    [
      {
        "/customers/stan-sack": {
          ttl: 5500
        }
      },
      {
        "/customers/stan-sack": {
          ttl: 5500
        }
      }
    ]
  ])("Custom cloudfront inputs", (inputCloudfrontConfig, expectedInConfig) => {
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");
    const { origins = [], defaults = {}, ...other } = expectedInConfig;

    const expectedDefaultCacheBehaviour = {
      ...defaults,
      "lambda@edge": {
        "origin-request":
          "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1",
        ...defaults["lambda@edge"]
      }
    };

    const expectedApiCacheBehaviour = {
      ...expectedInConfig["api/*"],
      allowedHttpMethods: [
        "HEAD",
        "DELETE",
        "POST",
        "GET",
        "OPTIONS",
        "PUT",
        "PATCH"
      ],
      "lambda@edge": {
        "origin-request":
          "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1",
        ...(expectedInConfig["api/*"] &&
          expectedInConfig["api/*"]["lambda@edge"])
      }
    };

    let customPageCacheBehaviours = {};
    Object.entries(other).forEach(([path, cacheBehaviour]) => {
      customPageCacheBehaviours[path] = {
        ...cacheBehaviour,
        "lambda@edge": {
          "origin-request":
            "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1",
          ...(cacheBehaviour && cacheBehaviour["lambda@edge"])
        }
      };
    });

    const cloudfrontConfig = {
      defaults: {
        ttl: 0,
        allowedHttpMethods: ["HEAD", "GET"],
        forward: {
          cookies: "all",
          queryString: true
        },
        ...expectedDefaultCacheBehaviour
      },
      origins: [
        {
          pathPatterns: {
            ...customPageCacheBehaviours,
            "_next/*": {
              ...customPageCacheBehaviours["_next/*"],
              ttl: 86400
            },
            "api/*": {
              ttl: 0,
              ...expectedApiCacheBehaviour
            },
            "static/*": {
              ...customPageCacheBehaviours["static/*"],
              ttl: 86400
            }
          },
          private: true,
          url: "http://bucket-xyz.s3.amazonaws.com"
        },
        ...origins
      ]
    };

    beforeEach(async () => {
      process.chdir(fixturePath);

      mockCloudFront.mockResolvedValueOnce({
        url: "https://cloudfrontdistrib.amazonaws.com"
      });

      const component = createNextComponent();

      componentOutputs = await component.default({
        cloudfront: inputCloudfrontConfig
      });
    });

    it("Sets cloudfront options if present", () => {
      expect(mockCloudFront).toBeCalledWith(
        expect.objectContaining(cloudfrontConfig)
      );
    });
  });

  describe.each`
    cloudFrontInput                                | expectedErrorMessage
    ${{ "some-invalid-page-route": { ttl: 100 } }} | ${'Could not find next.js pages for "some-invalid-page-route"'}
    ${{ "/api": { ttl: 100 } }}                    | ${'route "/api" is not supported'}
    ${{ api: { ttl: 100 } }}                       | ${'route "api" is not supported'}
    ${{ "api/test": { ttl: 100 } }}                | ${'route "api/test" is not supported'}
  `(
    "Invalid cloudfront inputs",
    ({ cloudFrontInput, expectedErrorMessage }) => {
      const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

      beforeEach(async () => {
        process.chdir(fixturePath);
      });

      it("throws the correct error", async () => {
        expect.assertions(1);

        try {
          await createNextComponent().default({
            cloudfront: cloudFrontInput
          });
        } catch (err) {
          expect(err.message).toContain(expectedErrorMessage);
        }
      });
    }
  );
});
