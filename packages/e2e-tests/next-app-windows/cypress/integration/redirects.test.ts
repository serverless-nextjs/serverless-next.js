describe("Redirects Tests", () => {
  const buildId = Cypress.env("NEXT_BUILD_ID");

  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Pages redirect to non-trailing slash path", () => {
    [
      { path: "/ssr-page/", expectedStatus: 200 },
      { path: "/ssg-page/", expectedStatus: 200 },
      { path: "/errored-page/", expectedStatus: 500 },
      { path: "/errored-page-new-ssr/", expectedStatus: 500 },
      { path: "/unmatched/", expectedStatus: 404 }
    ].forEach(({ path, expectedStatus }) => {
      it(`redirects page ${path}`, () => {
        cy.ensureRouteHasStatusCode(path, 308);

        const redirectedPath = path.slice(0, -1);

        // Verify redirect response
        cy.verifyRedirect(path, redirectedPath, 308);

        // Verify status after following redirect
        cy.request({
          url: path,
          followRedirect: true,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.equal(expectedStatus);
        });

        // Visit to follow redirect
        cy.visit(path, { failOnStatusCode: false });
        cy.location("pathname").should("eq", redirectedPath);
      });
    });
  });

  describe("Non-redirect cases", () => {
    [
      {
        path: "//example.com/",
        expectedPath: "/example.com",
        expectedStatus: 308
      }
    ].forEach(({ path, expectedPath, expectedStatus }) => {
      it(`does not redirect page ${path}`, () => {
        // These cases should not redirect ever due to security
        cy.ensureRouteHasStatusCode(path, expectedStatus);

        cy.visit(path, { failOnStatusCode: false });
        cy.location("pathname").should("eq", expectedPath);
        cy.contains("404");
      });
    });
  });

  describe("Public files always redirect to non-trailing slash path", () => {
    [{ path: "/app-store-badge.png/" }].forEach(({ path }) => {
      it(`redirects file ${path}`, () => {
        const redirectedPath = path.slice(0, -1);

        // Verify redirect response
        cy.verifyRedirect(path, redirectedPath, 308);

        // We can't use visit to follow redirect as it expects HTML content, not files.
        cy.request(path).then((response) => {
          expect(response.status).to.equal(200);
        });
      });
    });
  });

  describe("Data requests always redirect to non-trailing slash path", () => {
    [
      { path: "/" },
      { path: "/index.json/" },
      { path: "/ssg-page.json/" }
    ].forEach(({ path }) => {
      const fullPath = `/_next/data/${buildId}${path}`;

      it(`redirects data request ${fullPath}`, () => {
        const redirectedPath = fullPath.slice(0, -1);

        // Verify redirect response
        cy.verifyRedirect(fullPath, redirectedPath, 308);

        // We can't use visit to follow redirect as it expects HTML content, not files.
        cy.request(fullPath).then((response) => {
          expect(response.status).to.equal(200);
        });
      });
    });
  });

  describe("Custom redirects defined in next.config.js", () => {
    [
      {
        path: "/permanent-redirect",
        expectedRedirect: "/ssr-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/permanent-redirect?a=123",
        expectedRedirect: "/ssr-page?a=123",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/temporary-redirect",
        expectedRedirect: "/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 307
      },
      {
        path: "/wildcard-redirect-1/a/b/c/d",
        expectedRedirect: "/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/wildcard-redirect-1/a",
        expectedRedirect: "/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/wildcard-redirect-2/a", // Redirects but the destination serves a 404
        expectedRedirect: "/wildcard-redirect-2-dest/a",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/regex-redirect-1/1234",
        expectedRedirect: "/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/regex-redirect-1/abcd", // Not a redirect as the regex is for numbers only
        expectedRedirect: null,
        expectedStatus: null,
        expectedRedirectStatus: null
      },
      {
        path: "/regex-redirect-2/12345", // Redirects but the destination serves a 404
        expectedRedirect: "/regex-redirect-2-dest/12345",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/custom-status-code-redirect",
        expectedRedirect: "/ssr-page",
        expectedStatus: 200,
        expectedRedirectStatus: 302
      },
      {
        path: "/api/deprecated-basic-api",
        expectedRedirect: "/api/basic-api",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/external-redirect-1",
        expectedRedirect: "https://jsonplaceholder.typicode.com",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/external-redirect-2/abcd",
        expectedRedirect: "https://jsonplaceholder.typicode.com/abcd",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/external-redirect-3/abcd",
        expectedRedirect: "https://jsonplaceholder.typicode.com/abcd/",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/query-string-destination-redirect",
        expectedRedirect: "/ssg-page?a=1234&b=1",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/query-string-destination-redirect?foo=bar",
        expectedRedirect: "/ssg-page?foo=bar&a=1234&b=1",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      }
    ].forEach(
      ({ path, expectedRedirect, expectedStatus, expectedRedirectStatus }) => {
        it(`redirects path ${path} to ${expectedRedirect}, redirect status: ${expectedRedirectStatus}`, () => {
          if (expectedRedirect) {
            // Verify redirect response
            cy.verifyRedirect(path, expectedRedirect, expectedRedirectStatus);

            // Follow redirect without failing on status code
            cy.request({
              url: path,
              followRedirect: true,
              failOnStatusCode: false
            }).then((response) => {
              expect(response.status).to.equal(expectedStatus);
            });
          } else {
            // If no redirect is expected, expect a 404 instead
            cy.request({
              url: path,
              followRedirect: false,
              failOnStatusCode: false
            }).then((response) => {
              expect(response.status).to.equal(404);
            });
          }
        });
      }
    );
  });
});
