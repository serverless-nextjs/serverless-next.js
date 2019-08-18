const createRouter = require("../router");
const manifest = require("./fixtures/manifest.json");

describe("Serverless router tests", () => {
  let router;

  beforeAll(() => {
    router = createRouter(manifest);
  });

  it('maps root path "/"', () => {
    expect(router("/")).toEqual("pages/index.js");
  });

  it('maps root path with dynamic segment "/[root]"', () => {
    expect(router("/xyz")).toEqual("pages/[root].js");
  });

  it('maps nested path "/customers/new"', () => {
    expect(router("/customers/new")).toEqual("pages/customers/new.js");
  });

  it('maps simple path with dynamic segment "/blog/[id]"', () => {
    expect(router("/blog/123")).toEqual("pages/blog/[id].js");
  });

  it('maps path with multiple dynamic segments "/customers/[customer]/[post]"', () => {
    expect(router("/customers/batman/howtoactlikeabat")).toEqual(
      "pages/customers/[customer]/[post].js"
    );
  });
});
