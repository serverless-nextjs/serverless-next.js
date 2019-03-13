// const path = require("path");
// const serverlessOfflineStart = require("../../utils/test/serverlessOfflineStart");
const httpGet = require("../../utils/test/httpGet");

describe("Local Deployment Tests (via serverless-offline)", () => {
  // let slsOffline;

  beforeAll(() => {
    // process.chdir(path.join(__dirname, "../app-with-serverless-offline"));
    // return serverlessOfflineStart().then(serverlessOffline => {
    //   slsOffline = serverlessOffline;
    // });
  });

  afterAll(() => {
    // slsOffline.stdin.pause();
    // slsOffline.kill();
  });

  it.skip("should return the index page content", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000").then(({ response, statusCode }) => {
      expect(statusCode).toBe(200);
      expect(response).toContain("Index page");
    });
  });

  it.skip("should return the about page content", () => {
    expect.assertions(2);

    return httpGet("http://localhost:3000/about").then(
      ({ response, statusCode }) => {
        expect(statusCode).toBe(200);
        expect(response).toContain("About page");
      }
    );
  });
});
