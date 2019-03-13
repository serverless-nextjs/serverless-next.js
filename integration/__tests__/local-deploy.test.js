const http = require("http");
// const path = require("path");
// const serverlessOfflineStart = require("../../utils/test/serverlessOfflineStart");

describe("Local Deployment Tests (via serverless-offline)", () => {
  // let slsOffline;

  // beforeAll(() => {
  //   process.chdir(path.join(__dirname, "../app-with-serverless-offline"));
  //   slsOffline = serverlessOfflineStart();
  // });

  // afterAll(() => {
  //   slsOffline.kill();
  // });

  it.skip("should return the about page content", done => {
    http
      .get("http://localhost:3000/about", res => {
        const { statusCode } = res;
        expect(statusCode).toBe(200);

        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", chunk => {
          rawData += chunk;
        });

        res.on("end", () => {
          expect(rawData).toContain("About page");
          done();
        });
      })
      .on("err", e => done(e));
  });
});
