const fse = require("fs-extra");
const mime = require("mime");

jest.mock("fs-extra");
jest.mock("mime");

describe.only("offline handlers", () => {
  beforeAll(() => {
    mime.getType.mockImplementation(() => "application/test");
  });

  ["_next", "_public", "_static"].forEach(handler => {
    const handlerFunc = require(`../${handler}`);
    describe(handler, () => {
      it("should return 200 and contents for found file", async () => {
        const fileContents = Buffer.from("test");
        fse.pathExists.mockResolvedValue(true);
        fse.readFile.mockResolvedValue(fileContents);

        const response = await handlerFunc.render({
          pathParameters: { proxy: "text.js" }
        });

        expect(fse.pathExists).toBeCalled();
        expect(fse.readFile).toBeCalled();

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(fileContents.toString("base64"));
        expect(response.headers["Content-Type"]).toBe("application/test");
      });

      it("should return 404 and reason for not found file", async () => {
        fse.pathExists.mockResolvedValue(false);

        const response = await handlerFunc.render({
          pathParameters: { proxy: "text.js" }
        });

        expect(fse.pathExists).toBeCalled();
        expect(fse.readFile).not.toBeCalled();

        expect(response.statusCode).toBe(404);
        expect(response.headers["X-Serverless-Error"]).toMatch(
          /Unable to find file/
        );
      });

      it("should return 400 and reason for exists but invalid file", async () => {
        fse.pathExists.mockResolvedValue(true);
        fse.readFile.mockRejectedValue("test");

        const response = await handlerFunc.render({
          pathParameters: { proxy: "text.js" }
        });

        expect(fse.pathExists).toBeCalled();
        expect(fse.readFile).toBeCalled();

        expect(response.statusCode).toBe(400);
        expect(response.headers["X-Serverless-Error"]).toMatch(/test/);
      });
    });
  });
});
