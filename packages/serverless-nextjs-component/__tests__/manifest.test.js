const nextBuild = require("next/dist/build").default;
const path = require("path");
const fse = require("fs-extra");
const NextjsComponent = require("../serverless");

jest.mock("next/dist/build");

const mockApiGatewayComponent = jest.fn();
jest.mock("@serverless/aws-api-gateway", () =>
  jest.fn(() => {
    const apig = mockApiGatewayComponent;
    apig.init = () => {};
    apig.default = () => {};
    apig.context = {};
    return apig;
  })
);

const mockLambdaComponent = jest.fn();
jest.mock("@serverless/aws-lambda", () =>
  jest.fn(() => {
    const lambda = mockLambdaComponent;
    lambda.init = () => {};
    lambda.default = () => {};
    lambda.context = {};
    return lambda;
  })
);

describe("manifest tests", () => {
  let tmpCwd;
  let manifest;

  const fixturePath = path.join(__dirname, "./fixtures/manifest");

  beforeEach(async () => {
    nextBuild.mockResolvedValueOnce();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    const component = new NextjsComponent();
    mockLambdaComponent.mockResolvedValueOnce({
      arn: "arn:aws:lambda:aws-region:acct-id:function:helloworld:$LATEST"
    });
    mockApiGatewayComponent.mockResolvedValueOnce({
      url: "https://ssr-api-xyz.execute-api.us-east-1.amazonaws.com/prod"
    });
    await component.default();

    manifest = await fse.readJSON(
      path.join(fixturePath, "serverless-nextjs-tmp/manifest.json")
    );
  });

  afterEach(() => {
    process.chdir(tmpCwd);
  });

  it("adds ssr page route", async () => {
    const {
      pages: {
        ssr: { nonDynamic }
      }
    } = manifest;

    expect(nonDynamic["/customers/new"]).toEqual("pages/customers/new.js");
  });

  it("adds ssr dynamic page route to express equivalent", async () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = manifest;

    expect(dynamic["/blog/:id"]).toEqual({
      file: "pages/blog/[id].js",
      regex: "^\\/blog\\/([^\\/]+?)(?:\\/)?$"
    });
  });

  it("adds dynamic page with multiple segments to express equivalent", async () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = manifest;

    expect(dynamic["/customers/:customer/:post"]).toEqual({
      file: "pages/customers/[customer]/[post].js",
      regex: "^\\/customers\\/([^\\/]+?)\\/([^\\/]+?)(?:\\/)?$"
    });
  });

  it("adds static page route", async () => {
    const {
      pages: { html }
    } = manifest;

    expect(html["/terms"]).toEqual("pages/terms.html");
  });

  it("adds public files", async () => {
    const { publicFiles } = manifest;

    expect(publicFiles).toEqual({
      "/favicon.ico": "favicon.ico",
      "/sw.js": "sw.js"
    });
  });

  it("adds the full manifest", async () => {
    const {
      pages: {
        ssr: { dynamic, nonDynamic },
        html
      }
    } = manifest;

    expect(dynamic).toEqual({
      "/:root": {
        file: "pages/[root].js",
        regex: expect.any(String)
      },
      "/blog/:id": {
        file: "pages/blog/[id].js",
        regex: expect.any(String)
      },
      "/customers/:customer": {
        file: "pages/customers/[customer].js",
        regex: expect.any(String)
      },
      "/customers/:customer/:post": {
        file: "pages/customers/[customer]/[post].js",
        regex: expect.any(String)
      },
      "/customers/:customer/profile": {
        file: "pages/customers/[customer]/profile.js",
        regex: expect.any(String)
      }
    });

    expect(nonDynamic).toEqual({
      "/customers/new": "pages/customers/new.js",
      "/": "pages/index.js",
      "/_app": "pages/_app.js",
      "/_document": "pages/_document.js",
      "/404": "pages/404.js"
    });

    expect(html).toEqual({
      "/terms": "pages/terms.html"
    });
  });

  it.skip("adds ssr api domain", () => {
    const {
      cloudFrontOrigins: { ssrApi }
    } = manifest;

    expect(mockLambdaComponent).toBeCalledWith({
      name: "serverless-nextjs-ssr-backend",
      description: "Backend lambda to render SSR pages",
      memory: 896,
      timeout: 10,
      runtime: "nodejs8.10",
      code: "./serverless-nextjs-tmp",
      role: roleOutputs,
      handler: "shim.handler",
      shims: [path.join(__dirname, "shim.js")],
      env: inputs.env || {},
      bucket: bucketOutputs.name,
      region: inputs.region
    });
    expect(mockApiGatewayComponent).toBeCalledWith({
      name: "serverless-nextjs-ssr-api",
      stage: "production",
      description: "SSR Api for nextjs serverless pages",
      region: "us-east-1",
      endpoints: [
        {
          path: "/",
          method: "any",
          function:
            "arn:aws:lambda:aws-region:acct-id:function:helloworld:$LATEST"
        },
        {
          path: "/{proxy+}",
          method: "any",
          function:
            "arn:aws:lambda:aws-region:acct-id:function:helloworld:$LATEST"
        }
      ]
    });
    expect(ssrApi).toEqual({
      domainName: "ssr-api-xyz.execute-api.us-east-1.amazonaws.com"
    });
  });
});
