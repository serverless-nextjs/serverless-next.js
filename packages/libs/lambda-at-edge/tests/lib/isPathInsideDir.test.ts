import { isPathInsideDir } from "../../src/lib/isPathInsideDir";

describe("isPathInsideDir", () => {
  it("should return false when path is not inside dir", () => {
    const isInsideDir = isPathInsideDir("/serverless/default-lambda");

    expect(isInsideDir("/")).toEqual(false);
    expect(isInsideDir("/foo")).toEqual(false);
    expect(isInsideDir("/serverless")).toEqual(false);
    expect(isInsideDir("/serverless/default-lambda")).toEqual(false);
  });

  it("should return true when path is inside dir", () => {
    const isInsideDir = isPathInsideDir("/serverless/default-lambda");

    expect(isInsideDir("/serverless/default-lambda/index.js")).toEqual(true);
    expect(
      isInsideDir("/serverless/default-lambda/node_modules/index.js")
    ).toEqual(true);
  });
});
