import { getRewritePath, isExternalRewrite } from "../../src/route/rewrite";
import { RoutesManifest } from "../../src/types";

describe("Rewriter Tests", () => {
  describe("getRewritePath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        rewrites: [
          {
            source: "/old-blog/:slug",
            destination: "/news/:slug",
            regex: "^/old-blog(?:/([^/]+?))$"
          },
          { source: "/a", destination: "/b", regex: "^/a$" },
          {
            source: "/:nextInternalLocale(en|nl|fr)/a",
            destination: "/:nextInternalLocale/b",
            regex: "^(?:/(en|nl|fr))/a$"
          },
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
            source: "/external-http",
            destination: "http://example.com",
            regex: "^/external$"
          },
          {
            source: "/invalid-destination",
            destination: "ftp://example.com",
            regex: "^/invalid-destination$"
          },
          {
            source: "/query/:path",
            destination: "/target?a=b",
            regex: "^/query(?:/([^/]+?))$"
          },
          {
            source: "/manual-query/:path",
            destination: "/target?key=:path",
            regex: "^/manual-query(?:/([^/]+?))$"
          },
          {
            source: "/multi-query/:path*",
            destination: "/target",
            regex: "^/multi-query(?:/([^/]+?))$"
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
      ${"/old-users/abc"}       | ${undefined}
      ${"/external"}            | ${"https://example.com"}
      ${"/external-http"}       | ${"http://example.com"}
      ${"/invalid-destination"} | ${undefined}
      ${"/en/a"}                | ${"/en/b"}
      ${"/fr/a"}                | ${"/fr/b"}
      ${"/query/foo"}           | ${"/target?a=b&path=foo"}
      ${"/manual-query/foo"}    | ${"/target?key=foo"}
      ${"/multi-query/foo/bar"} | ${"/target?path=foo&path=bar"}
    `(
      "rewrites path $path to $expectedRewrite",
      ({ path, expectedRewrite }) => {
        const rewrite = getRewritePath(path, routesManifest);

        if (expectedRewrite) {
          expect(rewrite).toEqual(expectedRewrite);
        } else {
          expect(rewrite).toBeUndefined();
        }
      }
    );
  });

  describe("isExternalRewrite()", () => {
    it.each`
      path                     | expected
      ${"http://example.com"}  | ${true}
      ${"https://example.com"} | ${true}
      ${"ftp://example.com"}   | ${false}
      ${"//example.com"}       | ${false}
    `("evaluates path $path as $expected", ({ path, expected }) => {
      expect(isExternalRewrite(path)).toBe(expected);
    });
  });
});
