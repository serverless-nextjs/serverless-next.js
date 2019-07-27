const nextBuild = require("next/dist/build");
const path = require("path");
const AdmZip = require("adm-zip");
const readCloudFormationUpdateTemplate = require("../utils/test/readCloudFormationUpdateTemplate");
const testableServerless = require("../utils/test/testableServerless");
const {
  mockDescribeStacks,
  mockCreateStack,
  mockDescribeStackEvents,
  mockDescribeStackResource,
  mockListObjectsV2,
  mockGetCallerIdentity,
  mockUpdateStack,
  mockGetRestApis
} = require("aws-sdk");

jest.mock("next/dist/build");
jest.mock("aws-sdk");

jest.useFakeTimers();

describe("one page app", () => {
  const fixturePath = path.join(__dirname, "./fixtures/one-page-app");

  let cloudFormationUpdateResources;

  beforeAll(async () => {
    mockDescribeStacks.mockReturnValueOnce({
      promise: () => Promise.reject(new Error("Stack does not exist."))
    });
    mockCreateStack.mockReturnValue({
      promise: () => Promise.resolve({ StackId: "MockedStack" })
    });
    var aYearFromNow = new Date();
    aYearFromNow.setFullYear(aYearFromNow.getFullYear() + 1);
    mockDescribeStackEvents.mockReturnValue({
      promise: () =>
        Promise.resolve({
          StackEvents: [
            {
              StackId: "MockedStack",
              ResourceType: "AWS::CloudFormation::Stack",
              ResourceStatus: "CREATE_COMPLETE",
              Timestamp: aYearFromNow
            }
          ]
        })
    });
    mockDescribeStackResource.mockReturnValue({
      promise: () =>
        Promise.resolve({
          StackResourceDetail: {
            StackId: "MockedStack",
            PhysicalResourceId: "MockedStackPhysicalResourceId"
          }
        })
    });
    mockListObjectsV2.mockReturnValue({
      promise: () => Promise.resolve({ Contents: [] })
    });
    mockGetCallerIdentity.mockReturnValue({
      promise: () =>
        Promise.resolve({ Arn: "arn:aws:iam:testAcctId:testUser/xyz" })
    });
    mockUpdateStack.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          StackId: "MockedStack"
        })
    });
    mockDescribeStacks.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          Stacks: [
            {
              StackId: "MockedStack",
              Outputs: []
            }
          ]
        })
    });
    mockGetRestApis.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          items: [{ id: "mockedApi" }]
        })
    });
    nextBuild.default.mockResolvedValue();

    await testableServerless(fixturePath, "deploy");

    const cloudFormationUpdateTemplate = await readCloudFormationUpdateTemplate(
      fixturePath
    );

    cloudFormationUpdateResources = cloudFormationUpdateTemplate.Resources;
  });

  describe("Assets Bucket", () => {
    let assetsBucket;

    beforeAll(() => {
      assetsBucket = cloudFormationUpdateResources.NextStaticAssetsS3Bucket;
    });

    it("is added to the update resources", () => {
      expect(assetsBucket).toBeDefined();
    });

    it("has correct bucket name", () => {
      expect(assetsBucket.Properties.BucketName).toEqual("onepageappbucket");
    });
  });

  describe("Page lambda function", () => {
    let pageLambda;

    beforeAll(() => {
      pageLambda = cloudFormationUpdateResources.HelloLambdaFunction;
    });

    it("creates lambda resource", () => {
      expect(pageLambda).toBeDefined();
    });

    it("has correct handler", () => {
      expect(pageLambda.Properties.Handler).toEqual(
        "sls-next-build/hello.render"
      );
    });

    it("has user defined memory size", () => {
      expect(pageLambda.Properties.MemorySize).toEqual(512);
    });
  });

  describe("Api Gateway", () => {
    let apiGateway;

    beforeAll(() => {
      apiGateway = cloudFormationUpdateResources.ApiGatewayRestApi;
    });

    it("creates api resource", () => {
      expect(apiGateway).toBeDefined();
    });

    describe("Page route", () => {
      it("creates page route resource with correct path", () => {
        const routeResource =
          cloudFormationUpdateResources.ApiGatewayResourceHello;

        expect(routeResource).toBeDefined();
        expect(routeResource.Properties.PathPart).toEqual("hello");
      });

      it("creates GET http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodHelloGet;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("GET");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceHello"
        );
      });

      it("creates HEAD http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodHelloHead;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("HEAD");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceHello"
        );
      });
    });
  });

  describe("Zip artifact", () => {
    let zipEntryNames;

    beforeAll(() => {
      const zip = new AdmZip(
        `${fixturePath}/.serverless/one-page-app-fixture.zip`
      );
      const zipEntries = zip.getEntries();
      zipEntryNames = zipEntries.map(ze => ze.entryName);
    });

    it("contains next compiled page", () => {
      expect(zipEntryNames).toContain(`sls-next-build/hello.original.js`);
    });

    it("contains plugin handler", () => {
      expect(zipEntryNames).toContain(`sls-next-build/hello.js`);
    });
  });
});
