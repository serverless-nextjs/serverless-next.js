const path = require("path");
const packageTestService = require("../../utils/test/packageTestService");

describe("Package Tests", () => {
  let cloudFormationTemplateUpdate;
  let resources;

  beforeAll(() => {
    process.chdir(path.join(__dirname, "../basic-app"));
    packageTestService();
    cloudFormationTemplateUpdate = require("../basic-app/.serverless/cloudformation-template-update-stack.json");
    resources = cloudFormationTemplateUpdate.Resources;
  });

  describe("Lambdas", () => {
    let homePageLambdaFunction;
    let aboutPageLambdaFunction;

    beforeAll(() => {
      homePageLambdaFunction = resources.HomePageLambdaFunction;
      aboutPageLambdaFunction = resources.AboutPageLambdaFunction;
    });

    it("should create AWS Lambda resources for each page", () => {
      expect(homePageLambdaFunction).toBeDefined();
      expect(homePageLambdaFunction.Type).toEqual("AWS::Lambda::Function");

      expect(aboutPageLambdaFunction).toBeDefined();
      expect(aboutPageLambdaFunction.Type).toEqual("AWS::Lambda::Function");
    });

    it("should have correct handlers", () => {
      expect(homePageLambdaFunction.Properties.Handler).toEqual(
        "sls-next-build/home.render"
      );
      expect(aboutPageLambdaFunction.Properties.Handler).toEqual(
        "sls-next-build/about.render"
      );
    });
  });

  describe("API Gateway", () => {
    let apiGWHomePageResource;
    let apiGWAboutPageResource;

    beforeAll(() => {
      apiGWHomePageResource = resources.ApiGatewayResourceHome;
      apiGWAboutPageResource = resources.ApiGatewayResourceAbout;
    });

    it("should create api gateway resources", () => {
      expect(apiGWHomePageResource).toBeDefined();
      expect(apiGWAboutPageResource).toBeDefined();

      expect(apiGWHomePageResource.Type).toEqual("AWS::ApiGateway::Resource");
      expect(apiGWAboutPageResource.Type).toEqual("AWS::ApiGateway::Resource");
    });

    it("should have correct URI paths", () => {
      expect(apiGWHomePageResource.Properties.PathPart).toEqual("home");
      expect(apiGWAboutPageResource.Properties.PathPart).toEqual("about");
    });
  });
});
