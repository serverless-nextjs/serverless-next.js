const createBuildManifest = require("../create-build-manifest");

describe("createBuildManifest", () => {
  it("maps ssr page route", () => {
    const {
      pages: {
        ssr: { nonDynamic }
      }
    } = createBuildManifest({
      "/customers/new": "pages/customers/new.js"
    });

    expect(nonDynamic).toEqual({
      "/customers/new": "pages/customers/new.js"
    });
  });

  it("maps ssr dynamic page route to express equivalent", () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = createBuildManifest({
      "/blog/[id]": "pages/blog/[id].js"
    });

    expect(dynamic).toEqual({
      "/blog/:id": {
        file: "pages/blog/[id].js",
        regex: "^\\/blog\\/([^\\/]+?)(?:\\/)?$"
      }
    });
  });

  it("maps dynamic page with multiple segments to express equivalent", () => {
    const {
      pages: {
        ssr: { dynamic }
      }
    } = createBuildManifest({
      "/customers/[customer]/[post]": "pages/[customer]/[post].js"
    });

    expect(dynamic).toEqual({
      "/customers/:customer/:post": {
        file: "pages/[customer]/[post].js",
        regex: "^\\/customers\\/([^\\/]+?)\\/([^\\/]+?)(?:\\/)?$"
      }
    });
  });

  it("maps static page route", () => {
    const {
      pages: { html }
    } = createBuildManifest({
      "/terms": "pages/terms.html"
    });

    expect(html).toEqual({
      "/terms": "pages/terms.html"
    });
  });

  it("maps a full manifest", () => {
    const pagesManifest = {
      "/blog/[id]": "pages/blog/[id].js",
      "/customers/[customer]/[post]": "pages/customers/[customer]/[post].js",
      "/customers/[customer]/profile": "pages/customers/[customer]/profile.js",
      "/customers/new": "pages/customers/new.js",
      "/terms": "pages/terms.html",
      "/": "pages/index.js",
      "/_app": "pages/_app.js",
      "/_document": "pages/_document.js",
      "/404": "pages/404.js"
    };

    const {
      pages: {
        ssr: { dynamic, nonDynamic },
        html
      }
    } = createBuildManifest(pagesManifest);

    expect(dynamic).toEqual({
      "/blog/:id": {
        file: "pages/blog/[id].js",
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
