import { getRewritePath, isExternalRewrite } from "../../src/route/rewrite";
import { PageManifest, RoutesManifest } from "../../src/types";

describe("Rewriter Tests", () => {
  describe("getRewritePath()", () => {
    let routesManifest: RoutesManifest;
    let pageManifest: PageManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        rewrites: [
          {
            source: "/old-blog/:slug",
            destination: "/news/:slug"
          },
          { source: "/a", destination: "/b" },
          {
            source: "/:nextInternalLocale(en|nl|fr)/a",
            destination: "/:nextInternalLocale/b"
          },
          { source: "/c", destination: "/d" },
          {
            source: "/old-users/:id(\\d{1,})",
            destination: "/users/:id"
          },
          {
            source: "/external",
            destination: "https://example.com"
          },
          {
            source: "/external-http",
            destination: "http://example.com"
          },
          {
            source: "/invalid-destination",
            destination: "ftp://example.com"
          },
          {
            source: "/query/:path",
            destination: "/target?a=b"
          },
          {
            source: "/manual-query/:path",
            destination: "/target?key=:path"
          },
          {
            source: "/multi-query/:path*",
            destination: "/target"
          },
          {
            source: "/no-op-rewrite",
            destination: "/no-op-rewrite"
          },
          {
            source: "/no-op-rewrite",
            destination: "/actual-no-op-rewrite-destination"
          }
        ],
        redirects: []
      };

      pageManifest = {
        publicFiles: {},
        trailingSlash: false,
        buildId: "test-build-id",
        pages: {
          dynamic: [],
          html: {
            dynamic: {},
            nonDynamic: {}
          },
          ssg: {
            dynamic: {},
            nonDynamic: {},
            notFound: {}
          },
          ssr: {
            dynamic: {},
            nonDynamic: {}
          }
        }
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
      ${"/no-op-rewrite"}       | ${"/actual-no-op-rewrite-destination"}
    `(
      "rewrites path $path to $expectedRewrite",
      ({ path, expectedRewrite }) => {
        const req = {
          headers: {
            host: [{ key: "Host", value: "next-serverless.com" }]
          },
          uri: path
        };
        const rewrite = getRewritePath(req, path, routesManifest, pageManifest);

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
