import { getRewritePath } from "../../src/routing/rewriter";
import { RoutesManifest } from "../../types";

describe("Rewriter Tests", () => {
  describe("getRewritePath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        rewrites: [
          {
            source: "/old-blog/:slug",
            destination: "/news/:slug",
            regex: "^/old-blog(?:/([^/]+?))$"
          },
          { source: "/a", destination: "/b", regex: "^/a$" },
          { source: "/c", destination: "/d", regex: "^/c$" },
          {
            source: "/old-users/:id(\\d{1,})",
            destination: "/users/:id",
            regex: "^/old-users(?:/(\\d{1,}))$"
          },
          {
            source: "/external",
            destination: "https://example.com",
            regex: "^/external$"
          },
          {
            source: "/invalid-destination",
            destination: "ftp://example.com",
            regex: "^/invalid-destination$"
          }
        ],
        redirects: []
      };
    });

    it.each`
      path                      | expectedRewrite
      ${"/a"}                   | ${"/b"}
      ${"/c"}                   | ${"/d"}
      ${"/old-blog/abc"}        | ${"/news/abc"}
      ${"/old-users/1234"}      | ${"/users/1234"}
      ${"/old-users/abc"}       | ${null}
      ${"/external"}            | ${"https://example.com"}
      ${"/invalid-destination"} | ${null}
    `(
      "redirects path $path to $expectedRedirect",
      ({ path, expectedRewrite }) => {
        const rewrite = getRewritePath(path, routesManifest);

        if (expectedRewrite) {
          expect(rewrite).toEqual(expectedRewrite);
        } else {
          expect(rewrite).toBeNull();
        }
      }
    );
  });
});
