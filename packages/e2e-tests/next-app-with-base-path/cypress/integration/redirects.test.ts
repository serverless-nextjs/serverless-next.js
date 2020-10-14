describe("Redirects Tests", () => {
  const buildId = Cypress.env("NEXT_BUILD_ID");

  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Pages redirect to non-trailing slash path", () => {
    [
      { path: "/basepath/ssr-page/", expectedStatus: 200 },
      { path: "/basepath/ssg-page/", expectedStatus: 200 },
      { path: "/basepath/errored-page/", expectedStatus: 500 },
      { path: "/basepath/errored-page-new-ssr/", expectedStatus: 500 },
      { path: "/basepath/unmatched/", expectedStatus: 404 }
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

  describe("Public files always redirect to non-trailing slash path", () => {
    [{ path: "/basepath/app-store-badge.png/" }].forEach(({ path }) => {
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
      const fullPath = `/basepath/_next/data/${buildId}${path}`;

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
        path: "/basepath/permanent-redirect",
        expectedRedirect: "/basepath/ssr-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/permanent-redirect?a=123",
        expectedRedirect: "/basepath/ssr-page?a=123",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/temporary-redirect",
        expectedRedirect: "/basepath/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 307
      },
      {
        path: "/basepath/wildcard-redirect-1/a/b/c/d",
        expectedRedirect: "/basepath/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/wildcard-redirect-1/a",
        expectedRedirect: "/basepath/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/wildcard-redirect-2/a", // Redirects but the destination serves a 404
        expectedRedirect: "/basepath/wildcard-redirect-2-dest/a",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/regex-redirect-1/1234",
        expectedRedirect: "/basepath/ssg-page",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/regex-redirect-1/abcd", // Not a redirect as the regex is for numbers only
        expectedRedirect: null,
        expectedStatus: null,
        expectedRedirectStatus: null
      },
      {
        path: "/basepath/regex-redirect-2/12345", // Redirects but the destination serves a 404
        expectedRedirect: "/basepath/regex-redirect-2-dest/12345",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/custom-status-code-redirect",
        expectedRedirect: "/basepath/ssr-page",
        expectedStatus: 200,
        expectedRedirectStatus: 302
      },
      {
        path: "/basepath/api/deprecated-basic-api",
        expectedRedirect: "/basepath/api/basic-api",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/external-redirect-1",
        expectedRedirect: "https://api.github.com",
        expectedStatus: 200,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/external-redirect-2/abcd",
        expectedRedirect: "https://api.github.com/abcd",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/external-redirect-3/abcd",
        expectedRedirect: "https://api.github.com/abcd/",
        expectedStatus: 404,
        expectedRedirectStatus: 308
      },
      {
        path: "/basepath/query-string-destination-redirect",
        expectedRedirect: "/basepath/ssg-page?a=1234&b=1?",
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
