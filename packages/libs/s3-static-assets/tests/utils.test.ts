import readDirectoryFiles from "../src/lib/readDirectoryFiles";
import * as path from "path";

describe("readDirectoryFiles", () => {
  it("returns an empty array when the file is not found", () => {
    const files = readDirectoryFiles("/this/path/does/not/exist");
    expect(files).toStrictEqual([]);
  });

  it("returns all files from fixture without directories", () => {
    const files = readDirectoryFiles(
      path.join(__dirname, "./fixtures/app-basic")
    );
    expect(files.map((file) => file.path)).toStrictEqual([
      path.join(__dirname, "fixtures/app-basic/public/robots.txt"),
      path.join(__dirname, "fixtures/app-basic/static/robots.txt"),
      path.join(__dirname, "fixtures/app-basic/public/scripts/test-script.js"),
      path.join(__dirname, "fixtures/app-basic/static/scripts/test-script.js")
    ]);
  });
});
