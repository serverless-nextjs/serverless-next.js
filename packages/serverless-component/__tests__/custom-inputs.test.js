const fse = require("fs-extra");
const path = require("path");
const { mockDomain } = require("@sls-next/domain");
const { mockS3 } = require("@serverless/aws-s3");
const { mockUpload } = require("aws-sdk");
const { mockLambda, mockLambdaPublish } = require("@sls-next/aws-lambda");
const { mockCloudFront } = require("@sls-next/aws-cloudfront");
const NextjsComponent = require("../serverless");
const obtainDomains = require("../lib/obtainDomains");
const {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} = require("../constants");
const { cleanupFixtureDirectory } = require("../lib/test-utils");

const createNextComponent = (inputs) => {
  const component = new NextjsComponent(inputs);
  component.context.credentials = {
    aws: {
      accessKeyId: "123",
      secretAccessKey: "456"
    }
  };
  return component;
};

const mockServerlessComponentDependencies = ({ expectedDomain }) => {
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
};

describe("Custom inputs", () => {
  let componentOutputs;
  let consoleWarnSpy;

  beforeEach(() => {
    const realFseRemove = fse.remove.bind({});
    jest.spyOn(fse, "remove").mockImplementation((filePath) => {
      // don't delete mocked .next/ files as they're needed for the tests and committed to source control
      if (!filePath.includes(".next" + path.sep)) {
        return realFseRemove(filePath);
      }
    });

    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    fse.remove.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe.each`
    inputRegion    | expectedRegion
    ${undefined}   | ${"us-east-1"}
    ${"eu-west-2"} | ${"eu-west-2"}
  `(`When input region is $inputRegion`, ({ inputRegion, expectedRegion }) => {
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});

      const component = createNextComponent();

      componentOutputs = await component.default({
        bucketRegion: inputRegion
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`passes the ${expectedRegion} region to s3 component`, () => {
      expect(mockS3).toBeCalledWith(
        expect.objectContaining({
          region: expectedRegion
        })
      );
    });
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
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({
        expectedDomain
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
      return cleanupFixtureDirectory(fixturePath);
    });

    it("uses @sls-next/domain to provision custom domain", () => {
      const { domain, subdomain } = obtainDomains(inputDomains);

      expect(mockDomain).toBeCalledWith({
        defaultCloudfrontInputs: {},
        domainType: "both",
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

    it("outputs custom domain url", () => {
      expect(componentOutputs.appUrl).toEqual(expectedDomain);
    });
  });

  describe.each`
    nextConfigDir      | nextStaticDir      | fixturePath
    ${"nextConfigDir"} | ${"nextStaticDir"} | ${path.join(__dirname, "./fixtures/split-app")}
  `(
    "nextConfigDir=$nextConfigDir, nextStaticDir=$nextStaticDir",
    ({ fixturePath, ...inputs }) => {
      let tmpCwd;

      beforeEach(async () => {
        tmpCwd = process.cwd();
        process.chdir(fixturePath);

        mockServerlessComponentDependencies({});

        const component = createNextComponent();

        componentOutputs = await component.default({
          nextConfigDir: inputs.nextConfigDir,
          nextStaticDir: inputs.nextStaticDir
        });
      });

      afterEach(() => {
        process.chdir(tmpCwd);
        return cleanupFixtureDirectory(fixturePath);
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
    publicDirectoryCache                                           | expected
    ${undefined}                                                   | ${"public, max-age=31536000, must-revalidate"}
    ${false}                                                       | ${undefined}
    ${{ test: "/.(ico|png)$/i", value: "public, max-age=306000" }} | ${"public, max-age=306000"}
  `(
    "input=inputPublicDirectoryCache, expected=$expectedPublicDirectoryCache",
    ({ publicDirectoryCache, expected }) => {
      let tmpCwd;
      let fixturePath = path.join(__dirname, "./fixtures/simple-app");

      beforeEach(async () => {
        tmpCwd = process.cwd();
        process.chdir(fixturePath);

        mockServerlessComponentDependencies({});

        const component = createNextComponent();

        componentOutputs = await component.default({
          publicDirectoryCache
        });
      });

      afterEach(() => {
        process.chdir(tmpCwd);
        return cleanupFixtureDirectory(fixturePath);
      });

      it(`sets the ${expected} Cache - Control header on ${publicDirectoryCache} `, () => {
        expect(mockUpload).toBeCalledWith(
          expect.objectContaining({
            Key: expect.stringMatching("public/favicon.ico"),
            CacheControl: expected
          })
        );
      });
    }
  );

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
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});

      const component = createNextComponent({
        memory: inputMemory
      });

      componentOutputs = await component.default({
        memory: inputMemory
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda memory to ${expectedMemory.defaultMemory} and api lambda memory to ${expectedMemory.apiMemory} `, () => {
      const { defaultMemory, apiMemory } = expectedMemory;

      // default Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          memory: defaultMemory
        })
      );

      // api Lambda
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

      mockServerlessComponentDependencies({});

      const component = createNextComponent();

      componentOutputs = await component.default({
        timeout: inputTimeout
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda timeout to ${expectedTimeout.defaultTimeout} and api lambda timeout to ${expectedTimeout.apiTimeout} `, () => {
      const { defaultTimeout, apiTimeout } = expectedTimeout;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          timeout: defaultTimeout
        })
      );

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          timeout: apiTimeout
        })
      );
    });
  });

  describe.each`
    inputRuntime                                                | expectedRuntime
    ${undefined}                                                | ${{ defaultRuntime: "nodejs12.x", apiRuntime: "nodejs12.x" }}
    ${{}}                                                       | ${{ defaultRuntime: "nodejs12.x", apiRuntime: "nodejs12.x" }}
    ${"nodejs10.x"}                                             | ${{ defaultRuntime: "nodejs10.x", apiRuntime: "nodejs10.x" }}
    ${{ defaultLambda: "nodejs10.x" }}                          | ${{ defaultRuntime: "nodejs10.x", apiRuntime: "nodejs12.x" }}
    ${{ apiLambda: "nodejs10.x" }}                              | ${{ defaultRuntime: "nodejs12.x", apiRuntime: "nodejs10.x" }}
    ${{ defaultLambda: "nodejs10.x", apiLambda: "nodejs10.x" }} | ${{ defaultRuntime: "nodejs10.x", apiRuntime: "nodejs10.x" }}
  `("Input runtime options", ({ inputRuntime, expectedRuntime }) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});

      const component = createNextComponent();

      componentOutputs = await component.default({
        runtime: inputRuntime
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda runtime to ${expectedRuntime.defaultRuntime} and api lambda runtime to ${expectedRuntime.apiRuntime} `, () => {
      const { defaultRuntime, apiRuntime } = expectedRuntime;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          runtime: defaultRuntime
        })
      );

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          runtime: apiRuntime
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
    let tmpCwd;
    const fixturePath = path.join(__dirname, "./fixtures/generic-fixture");

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});

      const component = createNextComponent();

      componentOutputs = await component.default({
        name: inputName
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda name to ${expectedName.defaultName} and api lambda name to ${expectedName.apiName} `, () => {
      const { defaultName, apiName } = expectedName;

      const expectedDefaultObject = {
        code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR)
      };
      if (defaultName) expectedDefaultObject.name = defaultName;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining(expectedDefaultObject)
      );

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
      {
        defaults: {
          forward: { cookies: "all", headers: "X", queryString: true }
        }
      },
      {
        defaults: {
          forward: { cookies: "all", headers: "X", queryString: true }
        }
      }
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
    let tmpCwd;
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
        ...(expectedInConfig["api/*"] &&
          expectedInConfig["api/*"]["lambda@edge"]),
        "origin-request":
          "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1"
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
        compress: true,
        ...expectedDefaultCacheBehaviour
      },
      origins: [
        {
          pathPatterns: {
            ...customPageCacheBehaviours,
            "_next/static/*": {
              ...customPageCacheBehaviours["_next/static/*"],
              ttl: 86400,
              forward: {
                headers: "none",
                cookies: "none",
                queryString: false
              }
            },
            "_next/data/*": {
              ttl: 0,
              allowedHttpMethods: ["HEAD", "GET"],
              "lambda@edge": {
                "origin-request":
                  "arn:aws:lambda:us-east-1:123456789012:function:my-func:v1"
              }
            },
            "api/*": {
              ttl: 0,
              ...expectedApiCacheBehaviour
            },
            "static/*": {
              ...customPageCacheBehaviours["static/*"],
              ttl: 86400,
              forward: {
                headers: "none",
                cookies: "none",
                queryString: false
              }
            }
          },
          private: true,
          url: "http://bucket-xyz.s3.amazonaws.com"
        },
        ...origins
      ]
    };

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});

      const component = createNextComponent();

      componentOutputs = await component.default({
        cloudfront: inputCloudfrontConfig
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
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
      let tmpCwd;

      beforeEach(async () => {
        tmpCwd = process.cwd();
        process.chdir(fixturePath);

        mockServerlessComponentDependencies({});
      });

      afterEach(() => {
        process.chdir(tmpCwd);
        return cleanupFixtureDirectory(fixturePath);
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

  describe("Build using serverless trace target", () => {
    const fixturePath = path.join(__dirname, "./fixtures/simple-app");
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockServerlessComponentDependencies({});
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it("builds correctly", async () => {
      await createNextComponent().default({
        useServerlessTraceTarget: true
      });
    });
  });
});
