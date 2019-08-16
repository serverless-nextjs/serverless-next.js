const nextBuild = require("next/dist/build").default;
const path = require("path");
const build = require("../build");

jest.mock("next/dist/build");

describe("manifest tests", () => {
  let tmpCwd;
  const fixturePath = path.join(__dirname, "./fixtures/manifest");

  beforeAll(() => {
    nextBuild.mockResolvedValueOnce();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);
  });

  afterAll(() => {
    process.chdir(tmpCwd);
  });

  it("adds ssr page route", async () => {
    const {
      pages: {
        ssr: { nonDynamic }
      }
    } = await build();

    expect(nonDynamic["/customers/new"]).toEqual("pages/customers/new.js");
  });

  it("adds ssr dynamic page route to express equivalent", async () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = await build();

    expect(dynamic["/blog/:id"]).toEqual({
      file: "pages/blog/[id].js",
      regex: "^\\/blog\\/([^\\/]+?)(?:\\/)?$"
    });
  });

  it("adds dynamic page with multiple segments to express equivalent", async () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = await build();

    expect(dynamic["/customers/:customer/:post"]).toEqual({
      file: "pages/customers/[customer]/[post].js",
      regex: "^\\/customers\\/([^\\/]+?)\\/([^\\/]+?)(?:\\/)?$"
    });
  });

  it("adds static page route", async () => {
    const {
      pages: { html }
    } = await build();

    expect(html["/terms"]).toEqual("pages/terms.html");
  });

  it("adds public files", async () => {
    const { publicFiles } = await build();

    expect(publicFiles).toEqual({
      "/favicon.ico": "favicon.ico",
      "/sw.js": "sw.js"
    });
  });

  it("adds the full manifest", async () => {
    const {
      pages: {
        ssr: { dynamic, nonDynamic },
        html
      }
    } = await build();

    expect(dynamic).toEqual({
      "/:root": {
        file: "pages/[root].js",
        regex: expect.any(String)
      },
      "/blog/:id": {
        file: "pages/blog/[id].js",
        regex: expect.any(String)
      },
      "/customers/:customer": {
        file: "pages/customers/[customer].js",
        regex: expect.any(String)
      },
      "/customers/:customer/:post": {
        file: "pages/customers/[customer]/[post].js",
        regex: expect.any(String)
      },
      "/customers/:customer/profile": {
        file: "pages/customers/[customer]/profile.js",
        regex: expect.any(String)
      }
    });

    expect(nonDynamic).toEqual({
      "/customers/new": "pages/customers/new.js",
      "/": "pages/index.js",
      "/_app": "pages/_app.js",
      "/_document": "pages/_document.js",
      "/404": "pages/404.js"
    });

    expect(html).toEqual({
      "/terms": "pages/terms.html"
    });
  });
});
