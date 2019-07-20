const nextBuild = require("next/dist/build");
const path = require("path");
const Serverless = require("serverless");
const fse = require("fs-extra");
const AdmZip = require("adm-zip");

jest.mock("next/dist/build");

const readJsonFile = async filePath => {
  const str = await fse.readFile(filePath, "utf-8");
  return JSON.parse(str);
};

describe("package", () => {
  describe("one page app", () => {
    const fixturePath = path.join(__dirname, "./fixtures/one-page-app");

    let tmpCwd;
    let cloudFormationUpdateResources;

    const readCloudFormationUpdateTemplate = () => {
      return readJsonFile(
        `${fixturePath}/.serverless/cloudformation-template-update-stack.json`
      );
    };

    beforeAll(async () => {
      nextBuild.default.mockResolvedValue();

      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      const serverless = new Serverless();

      serverless.invocationId = "test-run";

      process.argv[2] = "package";

      await serverless.init();
      await serverless.run();

      const cloudFormationUpdateTemplate = await readCloudFormationUpdateTemplate();
      cloudFormationUpdateResources = cloudFormationUpdateTemplate.Resources;
    });

    afterAll(() => {
      process.chdir(tmpCwd);
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
});
