const nextBuild = require("next/dist/build");
const path = require("path");
const AdmZip = require("adm-zip");
const {
  readUpdateTemplate
} = require("../utils/test/readServerlessCFTemplate");
const testableServerless = require("../utils/test/testableServerless");

jest.mock("next/dist/build");

jest.setTimeout(10000);

describe("nested next config", () => {
  const fixturePath = path.join(__dirname, "./fixtures/nested-next-config");

  let cloudFormationUpdateResources;

  beforeAll(async () => {
    nextBuild.default.mockResolvedValue();

    await testableServerless(fixturePath, "package");

    const cloudFormationUpdateTemplate = await readUpdateTemplate(fixturePath);

    cloudFormationUpdateResources = cloudFormationUpdateTemplate.Resources;
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
        "app/sls-next-build/hello.render"
      );
    });

    describe("nested page", () => {
      let blogPostPageLambda;

      beforeAll(() => {
        blogPostPageLambda =
          cloudFormationUpdateResources.BlogDashpostLambdaFunction;
      });

      it("creates lambda resource", () => {
        expect(blogPostPageLambda).toBeDefined();
      });

      it("has correct handler", () => {
        expect(blogPostPageLambda.Properties.Handler).toEqual(
          "app/sls-next-build/blog/post.render"
        );
      });
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

      describe("nested page", () => {
        it("creates page route resource with correct path", () => {
          const blogResource =
            cloudFormationUpdateResources.ApiGatewayResourceBlog;

          const blogPostResource =
            cloudFormationUpdateResources.ApiGatewayResourceBlogPost;

          expect(blogResource).toBeDefined();
          expect(blogPostResource).toBeDefined();
          expect(blogResource.Properties.PathPart).toEqual("blog");
          expect(blogPostResource.Properties.PathPart).toEqual("post");
        });
      });
    });
  });

  describe("Zip artifact", () => {
    let zipEntryNames;

    beforeAll(() => {
      const zip = new AdmZip(
        `${fixturePath}/.serverless/nested-next-config-fixture.zip`
      );
      const zipEntries = zip.getEntries();
      zipEntryNames = zipEntries.map((ze) => ze.entryName);
    });

    it("contains next compiled page", () => {
      expect(zipEntryNames).toContain(`app/sls-next-build/hello.original.js`);
    });

    it("contains plugin handler", () => {
      expect(zipEntryNames).toContain(`app/sls-next-build/hello.js`);
    });

    describe("nested page", () => {
      it("contains next compiled page", () => {
        expect(zipEntryNames).toContain(
          `app/sls-next-build/blog/post.original.js`
        );
      });

      it("contains plugin handler", () => {
        expect(zipEntryNames).toContain(`app/sls-next-build/blog/post.js`);
      });
    });
  });
});
