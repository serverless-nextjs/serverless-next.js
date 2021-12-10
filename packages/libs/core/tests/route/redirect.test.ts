import {
  createRedirectResponse,
  getRedirectPath
} from "../../src/route/redirect";
import { Request, RoutesManifest } from "../../src";

describe("Redirector Tests", () => {
  describe("getRedirectPath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        rewrites: [],
        redirects: [
          {
            source: "/old-blog/:slug",
            destination: "/news/:slug",
            statusCode: 308
          },
          { source: "/a", destination: "/b", statusCode: 308 },
          {
            source: "/:nextInternalLocale(en|nl|fr)/a",
            destination: "/:nextInternalLocale/b",
            statusCode: 308
          },
          { source: "/c", destination: "/d", statusCode: 302 },
          {
            source: "/old-users/:id(\\d{1,})",
            destination: "/users/:id",
            statusCode: 307
          },
          {
            source: "/external",
            destination: "https://example.com",
            statusCode: 308
          },
          {
            source: "/external-2",
            destination: "https://example.com/?a=b",
            statusCode: 308
          },
          {
            source: "/invalid-destination",
            destination: "ftp://example.com",
            statusCode: 308
          }
        ]
      };
    });

    it.each`
      path                      | expectedRedirect              | expectedStatusCode
      ${"/a"}                   | ${"/b"}                       | ${308}
      ${"/c"}                   | ${"/d"}                       | ${302}
      ${"/old-blog/abc"}        | ${"/news/abc"}                | ${308}
      ${"/old-users/1234"}      | ${"/users/1234"}              | ${307}
      ${"/old-users/abc"}       | ${null}                       | ${null}
      ${"/external"}            | ${"https://example.com"}      | ${308}
      ${"/external-2"}          | ${"https://example.com/?a=b"} | ${308}
      ${"/invalid-destination"} | ${null}                       | ${null}
      ${"/en/a"}                | ${"/en/b"}                    | ${308}
      ${"/fr/a"}                | ${"/fr/b"}                    | ${308}
    `(
      "redirects path $path to $expectedRedirect",
      ({ path, expectedRedirect, expectedStatusCode }) => {
        const request = { uri: path } as unknown as Request;
        const redirect = getRedirectPath(request, routesManifest);

        if (expectedRedirect) {
          expect(redirect).toEqual({
            path: expectedRedirect,
            statusCode: expectedStatusCode
          });
        } else {
          expect(redirect).toBeNull();
        }
      }
    );
  });

  describe("createRedirectResponse()", () => {
    it("does a permanent redirect", () => {
      const response = createRedirectResponse("/terms", "", 308);
      expect(response).toEqual({
        isRedirect: true,
        status: 308,
        statusDescription: "Permanent Redirect",
        headers: {
          location: [
            {
              key: "Location",
              value: "/terms"
            }
          ],
          refresh: [
            // Required for IE11 compatibility
            {
              key: "Refresh",
              value: `0;url=/terms`
            }
          ],
          "cache-control": [
            {
              key: "Cache-Control",
              value: "s-maxage=0"
            }
          ]
        }
      });
    });

    it("does a temporary redirect with query parameters", () => {
      const response = createRedirectResponse("/terms", "a=123", 307);
      expect(response).toEqual({
        isRedirect: true,
        status: 307,
        statusDescription: "Temporary Redirect",
        headers: {
          location: [
            {
              key: "Location",
              value: "/terms?a=123"
            }
          ],
          refresh: [],
          "cache-control": [
            {
              key: "Cache-Control",
              value: "s-maxage=0"
            }
          ]
        }
      });
    });
  });
});
