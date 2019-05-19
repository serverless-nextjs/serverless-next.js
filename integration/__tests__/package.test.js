const path = require("path");
const AdmZip = require("adm-zip");
const fs = require("fs");
const packageTestService = require("../../packages/serverless-nextjs-plugin/utils/test/packageTestService");
const PluginBuildDir = require("../../packages/serverless-nextjs-plugin/classes/PluginBuildDir");

const readJsonFile = filePath => {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

describe.each`
  appDir                                    | appBuildDir
  ${"../basic-app"}                         | ${PluginBuildDir.BUILD_DIR_NAME}
  ${"../basic-app-with-nested-next-config"} | ${`app/${PluginBuildDir.BUILD_DIR_NAME}`}
`("$appDir - package tests", ({ appDir, appBuildDir }) => {
  const appServerlessDir = `${appDir}/.serverless`;

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

  describe("When no assetPrefix is configured in next.config", () => {
    beforeAll(() => {
      process.chdir(path.join(__dirname, appDir));
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
        let lambdaFunctions;

        beforeAll(() => {
          lambdaFunctions = {
            home: resources.HomeLambdaFunction,
            about: resources.AboutLambdaFunction,
            post: resources.PostLambdaFunction,
            blog: resources.BlogLambdaFunction,
            fridges: resources.CategoriesDashfridgeDashfridgesLambdaFunction
          };
        });

        it.each`
          pageName
          ${"home"}
          ${"about"}
          ${"blog"}
          ${"fridges"}
        `(
          "should create AWS Lambda resource for page $pageName",
          ({ pageName }) => {
            expect(lambdaFunctions[pageName].Type).toBeDefined();
            expect(lambdaFunctions[pageName].Type).toEqual(
              "AWS::Lambda::Function"
            );
          }
        );

        it.each`
          pageName     | handler
          ${"home"}    | ${`${appBuildDir}/home.render`}
          ${"about"}   | ${`${appBuildDir}/about.render`}
          ${"blog"}    | ${`${appBuildDir}/blog.render`}
          ${"fridges"} | ${`${appBuildDir}/categories/fridge/fridges.render`}
        `(
          "page $pageName should have handler $handler",
          ({ pageName, handler }) => {
            expect(lambdaFunctions[pageName].Properties.Handler).toEqual(
              handler
            );
          }
        );

        it("post page should have custom memorySize", () => {
          expect(lambdaFunctions["post"].Properties.MemorySize).toEqual(2048);
        });
      });

      describe("API gateway", () => {
        let apiGWPageResources;
        let apiGWGETMethodResources;
        let apiGWHEADMethodResources;

        beforeAll(() => {
          apiGWPageResources = {
            home: resources.ApiGatewayResourceHome,
            about: resources.ApiGatewayResourceAbout,
            post: resources.ApiGatewayResourcePosts,
            blog: resources.ApiGatewayResourceBlog,
            fridges: resources.ApiGatewayResourceCategoriesFridgeFridges
          };

          apiGWGETMethodResources = {
            home: resources.ApiGatewayMethodHomeGet,
            about: resources.ApiGatewayMethodAboutGet,
            post: resources.ApiGatewayMethodPostsIdVarGet,
            blog: resources.ApiGatewayMethodBlogGet,
            fridges: resources.ApiGatewayMethodCategoriesFridgeFridgesGet
          };

          apiGWHEADMethodResources = {
            home: resources.ApiGatewayMethodHomeHead,
            about: resources.ApiGatewayMethodAboutHead,
            post: resources.ApiGatewayMethodPostsIdVarHead,
            blog: resources.ApiGatewayMethodBlogHead,
            fridges: resources.ApiGatewayMethodCategoriesFridgeFridgesHead
          };
        });

        it.each`
          pageName
          ${"home"}
          ${"about"}
          ${"blog"}
          ${"fridges"}
        `(
          "should create api gateway resource for page $pageName",
          ({ pageName }) => {
            expect(apiGWPageResources[pageName]).toBeDefined();

            expect(apiGWPageResources[pageName].Type).toEqual(
              "AWS::ApiGateway::Resource"
            );
          }
        );

        it.each`
          pageName     | uri
          ${"home"}    | ${"home"}
          ${"about"}   | ${"about"}
          ${"blog"}    | ${"blog"}
          ${"fridges"} | ${"fridges"}
        `("page $pageName should have URI /$uri", ({ pageName }) => {
          expect(apiGWPageResources[pageName].Properties.PathPart).toEqual(
            pageName
          );
        });

        it.each`
          pageName     | uri
          ${"home"}    | ${"home"}
          ${"about"}   | ${"about"}
          ${"blog"}    | ${"blog"}
          ${"fridges"} | ${"fridges"}
        `("page $pageName should have GET and HEAD methods", ({ pageName }) => {
          expect(apiGWPageResources[pageName].Properties.PathPart).toEqual(
            pageName
          );
        });

        it.each`
          pageName     | uri
          ${"home"}    | ${"home"}
          ${"about"}   | ${"about"}
          ${"blog"}    | ${"blog"}
          ${"fridges"} | ${"fridges"}
        `(
          "page $pageName should have a GET and HEAD methods",
          ({ pageName }) => {
            expect(
              apiGWGETMethodResources[pageName].Properties.HttpMethod
            ).toEqual("GET");
            expect(
              apiGWHEADMethodResources[pageName].Properties.HttpMethod
            ).toEqual("HEAD");
          }
        );

        it("post page should have custom path and id parameter", () => {
          expect(apiGWPageResources["post"].Properties.PathPart).toEqual(
            "posts"
          );
          expect(
            resources.ApiGatewayResourcePostsIdVar.Properties.PathPart
          ).toEqual("{id}");
        });
      });
    });

    describe("Zip artifact", () => {
      it.each`
        compiledPage
        ${`${appBuildDir}/home`}
        ${`${appBuildDir}/about`}
        ${`${appBuildDir}/post`}
        ${`${appBuildDir}/blog`}
        ${`${appBuildDir}/categories/fridge/fridges`}
      `(
        "should contain $compiledPage js and $compiledPage original.js",
        ({ compiledPage }) => {
          const zip = new AdmZip(`${appServerlessDir}/basic-app.zip`);
          const zipEntries = zip.getEntries();
          const entryNames = zipEntries.map(ze => ze.entryName);

          expect(entryNames).toContain(`${compiledPage}.js`);
          expect(entryNames).toContain(`${compiledPage}.original.js`);
        }
      );
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
