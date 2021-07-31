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
      path.join(__dirname, "fixtures/app-basic/.next/prerender-manifest.json"),
      path.join(__dirname, "fixtures/app-basic/public/robots.txt"),
      path.join(__dirname, "fixtures/app-basic/static/robots.txt"),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages-manifest.json"
      ),
      path.join(__dirname, "fixtures/app-basic/public/scripts/test-script.js"),
      path.join(__dirname, "fixtures/app-basic/static/scripts/test-script.js"),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/index.html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/index.json"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/static/a_test_build_id/two.js"
      ),
      path.join(__dirname, "fixtures/app-basic/.next/static/chunks/chunk1.js"),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/static/runtime/runtime1.js"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms.html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/static/a_test_build_id/css/one.css"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms/[section].html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms/a.html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms/a.json"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms/b.html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/todos/terms/b.json"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/fr/todos/terms/c.html"
      ),
      path.join(
        __dirname,
        "fixtures/app-basic/.next/serverless/pages/fr/todos/terms/c.json"
      )
    ]);
  });
});
