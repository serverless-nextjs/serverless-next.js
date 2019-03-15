const path = require("path");
const AdmZip = require("adm-zip");
const fs = require("fs");
const packageTestService = require("../../utils/test/packageTestService");

const appServerlessDir = "../basic-app/.serverless";

const readJsonFile = filePath => {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const readCloudFormationCreateTemplate = () => {
  return readJsonFile(
    `${appServerlessDir}/cloudformation-template-create-stack.json`
  );
};

const readCloudFormationUpdateTemplate = () => {
  return readJsonFile(
    `${appServerlessDir}/cloudformation-template-update-stack.json`
  );
};

describe("Package Tests", () => {
  describe("When no assetPrefix is configured in next.config", () => {
    beforeAll(() => {
      process.chdir(path.join(__dirname, "../basic-app"));
      packageTestService();
    });

    describe("CloudFormationTemplateCreate", () => {
      let cloudFormationTemplateCreate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateCreate = readCloudFormationCreateTemplate();
        resources = cloudFormationTemplateCreate.Resources;
      });

      it("should not have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).not.toBeDefined();
      });
    });

    describe("CloudFormationTemplateUpdate", () => {
      let cloudFormationTemplateUpdate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateUpdate = readCloudFormationUpdateTemplate();
        resources = cloudFormationTemplateUpdate.Resources;
      });

      describe("Static assets bucket", () => {
        it("should not have a static assets bucket", () => {
          expect(resources.NextStaticAssetsS3Bucket).not.toBeDefined();
        });
      });

      describe("Page lambda functions", () => {
        let homePageLambdaFunction;
        let aboutPageLambdaFunction;
        let postPageLambdaFunction;

        beforeAll(() => {
          homePageLambdaFunction = resources.HomePageLambdaFunction;
          aboutPageLambdaFunction = resources.AboutPageLambdaFunction;
          postPageLambdaFunction = resources.PostPageLambdaFunction;
        });

        it("should create AWS Lambda resources for each page", () => {
          expect(homePageLambdaFunction).toBeDefined();
          expect(homePageLambdaFunction.Type).toEqual("AWS::Lambda::Function");

          expect(aboutPageLambdaFunction).toBeDefined();
          expect(aboutPageLambdaFunction.Type).toEqual("AWS::Lambda::Function");

          expect(postPageLambdaFunction).toBeDefined();
          expect(postPageLambdaFunction.Type).toEqual("AWS::Lambda::Function");
        });

        it("should have correct handlers", () => {
          expect(homePageLambdaFunction.Properties.Handler).toEqual(
            "sls-next-build/home.render"
          );
          expect(aboutPageLambdaFunction.Properties.Handler).toEqual(
            "sls-next-build/about.render"
          );
          expect(postPageLambdaFunction.Properties.Handler).toEqual(
            "sls-next-build/post.render"
          );
        });

        it("post page should have custom memorySize", () => {
          expect(postPageLambdaFunction.Properties.MemorySize).toEqual(2048);
        });
      });

      describe("API gateway", () => {
        let apiGWHomePageResource;
        let apiGWAboutPageResource;
        let apiGWPostPageResource;

        beforeAll(() => {
          apiGWHomePageResource = resources.ApiGatewayResourceHome;
          apiGWAboutPageResource = resources.ApiGatewayResourceAbout;
          apiGWPostPageResource = resources.ApiGatewayResourcePosts;
        });

        it("should create api gateway resources", () => {
          expect(apiGWHomePageResource).toBeDefined();
          expect(apiGWAboutPageResource).toBeDefined();
          expect(apiGWPostPageResource).toBeDefined();

          expect(apiGWHomePageResource.Type).toEqual(
            "AWS::ApiGateway::Resource"
          );
          expect(apiGWAboutPageResource.Type).toEqual(
            "AWS::ApiGateway::Resource"
          );
          expect(apiGWPostPageResource.Type).toEqual(
            "AWS::ApiGateway::Resource"
          );
        });

        it("should have correct URI paths", () => {
          expect(apiGWHomePageResource.Properties.PathPart).toEqual("home");
          expect(apiGWAboutPageResource.Properties.PathPart).toEqual("about");
        });

        it("post page should have custom path and id parameter", () => {
          expect(apiGWPostPageResource.Properties.PathPart).toEqual("posts");
          expect(
            resources.ApiGatewayResourcePostsIdVar.Properties.PathPart
          ).toEqual("{id}");
        });
      });
    });

    describe("Zip artifact", () => {
      it("should have the compiled page files inside the artifact", () => {
        const zip = new AdmZip(`${appServerlessDir}/basic-app.zip`);
        const zipEntries = zip.getEntries();
        const entryNames = zipEntries.map(ze => ze.entryName);

        expect(entryNames).toContain("sls-next-build/home.js");
        expect(entryNames).toContain("sls-next-build/about.js");
        expect(entryNames).toContain("sls-next-build/post.js");
        expect(entryNames).toContain("sls-next-build/home.original.js");
        expect(entryNames).toContain("sls-next-build/about.original.js");
        expect(entryNames).toContain("sls-next-build/post.original.js");
      });
    });
  });

  describe("When assetPrefix is configured in next.config", () => {
    beforeAll(() => {
      process.env.ASSET_PREFIX = "https://s3.amazonaws.com/mybucket";
      packageTestService();
    });

    afterAll(() => {
      delete process.env.ASSET_PREFIX;
    });

    describe("CloudFormationTemplateCreate", () => {
      let cloudFormationTemplateCreate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateCreate = readCloudFormationCreateTemplate();
        resources = cloudFormationTemplateCreate.Resources;
      });

      // TODO: Un-skip after figuring out a way of making serverless
      // write user defined changes to cloudformation-template-create-stack.json
      it.skip("should have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).toBeDefined();
      });
    });

    describe("CloudFormationTemplateUpdate", () => {
      let cloudFormationTemplateUpdate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateUpdate = readCloudFormationUpdateTemplate();
        resources = cloudFormationTemplateUpdate.Resources;
      });

      it("should have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).toBeDefined();
      });
    });
  });
});
