import { getRewritePath, isExternalRewrite } from "../../src/route/rewrite";
import { PageManifest, RoutesManifest } from "../../src/types";

const buildPageManifest = ({
  dynamic = [],
  html = {
    dynamic: {},
    nonDynamic: {}
  },
  ssg = {
    dynamic: {},
    nonDynamic: {},
    notFound: {}
  },
  ssr = {
    dynamic: {},
    nonDynamic: {}
  }
}: Partial<PageManifest["pages"]> = {}): PageManifest => {
  return {
    publicFiles: {},
    trailingSlash: false,
    buildId: "test-build-id",
    pages: {
      dynamic,
      html,
      ssg,
      ssr
    },
    domainRedirects: {},
    hasApiPages: false
  };
};

const buildRoutesManifest = ({
  rewrites = []
}: { rewrites?: RoutesManifest["rewrites"] } = {}): RoutesManifest => {
  return {
    rewrites,
    basePath: "",
    headers: [],
    redirects: []
  };
};

describe("Rewriter Tests", () => {
  describe("getRewritePath()", () => {
    describe("basic rewrites", () => {
      let routesManifest: RoutesManifest;
      let pageManifest: PageManifest;

      beforeAll(() => {
        routesManifest = buildRoutesManifest({
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
          ]
        });

        pageManifest = buildPageManifest();
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
          const rewrite = getRewritePath(
            req,
            path,
            routesManifest,
            pageManifest
          );

          if (expectedRewrite) {
            expect(rewrite).toEqual(expectedRewrite);
          } else {
            expect(rewrite).toBeUndefined();
          }
        }
      );
    });

    describe("fallback rewrites simulation", () => {
      const externalApp = "https://example.com";
      const routesManifest = buildRoutesManifest({
        rewrites: [
          {
            source: "/:path*",
            destination: "/:path*"
          },
          {
            source: "/:path*",
            destination: `${externalApp}/:path*`
          }
        ]
      });

      // path, expectedRewrite, typeOfPage:
      const cases: [string, string, "ssg" | "ssr" | "html"][] = [
        // request for existing dynamic-route
        [
          "/dynamic-route/@slug-id=",
          "/dynamic-route/@slug-id=?path=dynamic-route&path=@slug-id=",
          "ssg"
        ],
        [
          "/dynamic-route/@slug-id=",
          "/dynamic-route/@slug-id=?path=dynamic-route&path=@slug-id=",
          "ssr"
        ],
        [
          "/dynamic-route/@slug-id=",
          "/dynamic-route/@slug-id=?path=dynamic-route&path=@slug-id=",
          "html"
        ],
        // request for not existing dynamic-route
        [
          "/not-existing/@slug-id=",
          `${externalApp}/not-existing/@slug-id=?path=not-existing&path=@slug-id=`,
          "ssg"
        ],
        [
          "/not-existing/@slug-id=",
          `${externalApp}/not-existing/@slug-id=?path=not-existing&path=@slug-id=`,
          "ssr"
        ],
        [
          "/not-existing/@slug-id=",
          `${externalApp}/not-existing/@slug-id=?path=not-existing&path=@slug-id=`,
          "html"
        ],

        // request for existing dynamic-route with non-ASCII chars
        [
          "/dynamic-route/пример",
          "/dynamic-route/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=dynamic-route&path=пример",
          "ssg"
        ],
        [
          "/dynamic-route/пример",
          "/dynamic-route/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=dynamic-route&path=пример",
          "ssr"
        ],
        [
          "/dynamic-route/пример",
          "/dynamic-route/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=dynamic-route&path=пример",
          "html"
        ],
        // request for not existing dynamic-route with non-ASCII chars
        [
          "/not-existing/пример",
          `${externalApp}/not-existing/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=not-existing&path=пример`,
          "ssg"
        ],
        [
          "/not-existing/пример",
          `${externalApp}/not-existing/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=not-existing&path=пример`,
          "ssr"
        ],
        [
          "/not-existing/пример",
          `${externalApp}/not-existing/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80?path=not-existing&path=пример`,
          "html"
        ]
      ];

      it.each(cases)(
        "rewrites path: %p to %p when %p dynamic-route exists",
        (path, expectedRewrite, typeOfPage) => {
          const req = {
            headers: {
              host: [{ key: "Host", value: "next-serverless.com" }]
            },
            uri: path
          };

          const pageManifest = buildPageManifest({
            dynamic: [
              {
                route: "/dynamic-route/[slug]",
                regex: "^\\/dynamic\\-route(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
              }
            ],
            [typeOfPage]: {
              dynamic: {
                "/dynamic-route/[slug]": "pages/dynamic-route/[slug].html"
              },
              nonDynamic: {}
            }
          });

          const rewrite = getRewritePath(
            req,
            path,
            routesManifest,
            pageManifest
          );

          if (expectedRewrite) {
            expect(rewrite).toEqual(expectedRewrite);
          } else {
            expect(rewrite).toBeUndefined();
          }
        }
      );
    });
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
