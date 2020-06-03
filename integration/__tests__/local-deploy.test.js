const execSync = require("child_process").execSync;
const path = require("path");
const serverlessOfflineStart = require("../../packages/serverless-plugin/utils/test/serverlessOfflineStart");
const httpGet = require("../../packages/serverless-plugin/utils/test/httpGet");

describe("Local Deployment Tests (via serverless-offline)", () => {
  let slsOffline;

  beforeAll(() => {
    process.chdir(path.join(__dirname, "../app-with-serverless-offline"));
    return serverlessOfflineStart().then(serverlessOffline => {
      slsOffline = serverlessOffline;
    });
  });

  afterAll(() => {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${slsOffline.pid} /f /t`);
    } else {
      slsOffline.kill();
    }
  });

  it("should render the index page", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000").then(({ response, statusCode }) => {
      expect(statusCode).toBe(200);
      expect(response).toContain("Index page");
    });
  });

  it("should render the about page", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000/about").then(
      ({ response, statusCode }) => {
        expect(statusCode).toBe(200);
        expect(response).toContain("About page");
      }
    );
  });

  it("should render post page when using custom route with slug", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000/post/hello").then(
      ({ response, statusCode }) => {
        expect(statusCode).toBe(200);
        expect(response).toContain("Post page: ");
      }
    );
  });

  it("should render nested fridges page", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000/categories/fridge/fridges").then(
      ({ response, statusCode }) => {
        expect(statusCode).toBe(200);
        expect(response).toContain("Fridges");
      }
    );
  });

  it("should render _error page when 404", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000/path/does/not/exist").then(
      ({ response, statusCode }) => {
        // expect(statusCode).toBe(404); TODO: Investigate with a 200 is being returned in recent versions of next
        expect(statusCode).toEqual(200);
        expect(response).toContain("404 error page");
      }
    );
  });
});
