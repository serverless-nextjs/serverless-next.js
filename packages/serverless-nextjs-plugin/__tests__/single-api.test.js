const nextBuild = require("next/dist/build");
const path = require("path");
const AdmZip = require("adm-zip");
const readCloudFormationUpdateTemplate = require("../utils/test/readCloudFormationUpdateTemplate");
const testableServerless = require("../utils/test/testableServerless");

jest.mock("next/dist/build");

describe("single api", () => {
  const fixturePath = path.join(__dirname, "./fixtures/single-api");

  let cloudFormationUpdateResources;

  beforeAll(async () => {
    nextBuild.default.mockResolvedValue();

    await testableServerless(fixturePath, "package");

    const cloudFormationUpdateTemplate = await readCloudFormationUpdateTemplate(
      fixturePath
    );

    cloudFormationUpdateResources = cloudFormationUpdateTemplate.Resources;
  });

  describe("Page lambda function", () => {
    let pageLambda;

    beforeAll(() => {
      pageLambda = cloudFormationUpdateResources.ApiDashapiLambdaFunction;
    });

    it("creates lambda resource", () => {
      expect(pageLambda).toBeDefined();
    });

    it("has correct handler", () => {
      expect(pageLambda.Properties.Handler).toEqual(
        "sls-next-build/api/api.render"
      );
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
        const apiResource = cloudFormationUpdateResources.ApiGatewayResourceApi;

        const apiPostResource =
          cloudFormationUpdateResources.ApiGatewayResourceApiApi;

        expect(apiResource).toBeDefined();
        expect(apiPostResource).toBeDefined();
        expect(apiResource.Properties.PathPart).toEqual("api");
        expect(apiPostResource.Properties.PathPart).toEqual("api");
      });

      it("creates GET http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodApiApiGet;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("GET");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceApiApi"
        );
      });

      it("creates HEAD http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodApiApiHead;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("HEAD");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceApiApi"
        );
      });
    });
  });

  describe("Zip artifact", () => {
    let zipEntryNames;

    beforeAll(() => {
      const zip = new AdmZip(
        `${fixturePath}/.serverless/single-api-fixture.zip`
      );
      const zipEntries = zip.getEntries();
      zipEntryNames = zipEntries.map(ze => ze.entryName);
    });

    it("contains next compiled page", () => {
      expect(zipEntryNames).toContain(`sls-next-build/api/api.original.js`);
    });

    it("contains plugin handler", () => {
      expect(zipEntryNames).toContain(`sls-next-build/api/api.js`);
    });
  });
});
