import { getRewritePath } from "../../src/routing/rewriter";
import { RoutesManifest } from "../../types";

describe("Rewriter Tests", () => {
  describe("getRewritePath()", () => {
    let routesManifest: RoutesManifest;
    let router: (path: string) => string | null;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        rewrites: [
          {
            source: "/old-blog/:slug",
            destination: "/news/:slug"
          },
          { source: "/a", destination: "/b" },
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
            source: "/invalid-destination",
            destination: "ftp://example.com"
          }
        ],
        redirects: [],
        headers: []
      };

      router = (path: string): string | null => {
        return path;
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
      "rewrites path $path to $expectedRewrite",
      ({ path, expectedRewrite }) => {
        const rewrite = getRewritePath(path, {}, routesManifest, router, path);

        if (expectedRewrite) {
          expect(rewrite).toEqual(expectedRewrite);
        } else {
          expect(rewrite).toBeNull();
        }
      }
    );

    it.each`
      path    | expectedRewrite
      ${"/a"} | ${"/a"}
      ${"/b"} | ${"/another/b"}
    `(
      "no-op rewrite: rewrites $path to $expectedRewrite",
      ({ path, expectedRewrite }) => {
        routesManifest = {
          basePath: "",
          rewrites: [
            {
              source: "/:path*",
              destination: "/:path*"
            },
            {
              source: "/:path*",
              destination: "/another/:path*"
            }
          ],
          redirects: [],
          headers: []
        };

        router = (path: string): string | null => {
          if (path === "/a") {
            return "pages/a.html";
          } else if (path === "/b") {
            return "pages/404.html";
          } else {
            return null;
          }
        };

        const rewrite = getRewritePath(path, {}, routesManifest, router, path);

        if (expectedRewrite) {
          expect(rewrite).toEqual(expectedRewrite);
        } else {
          expect(rewrite).toBeNull();
        }
      }
    );
  });
});
