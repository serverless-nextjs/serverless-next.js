describe("Pages Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("SSR pages (getInitialProps)", () => {
    [
      { path: "/ssr-page" },
      { path: "/en/ssr-page" },
      { path: "/fr/ssr-page" }
    ].forEach(({ path }) => {
      it(`serves but does not cache page ${path}`, () => {
        cy.ensureRouteNotCached(path);

        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.visit(path);
      });

      ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"].forEach(
        (method) => {
          it(`allows HTTP method for path ${path}: ${method}`, () => {
            cy.request({ url: path, method: method }).then((response) => {
              if (method !== "HEAD") {
                cy.verifyResponseIsCompressed(response);
              }
              expect(response.status).to.equal(200);
            });
          });
        }
      );
    });
  });

  describe("SSR pages (getServerSideProps)", () => {
    [
      { path: "/ssr-page-2" },
      { path: "/en/ssr-page-2" },
      { path: "/fr/ssr-page-2" }
    ].forEach(({ path }) => {
      it(`serves but does not cache page ${path}`, () => {
        if (path === "/") {
          // Somehow "/" is matching everything, need to exclude static files
          cy.ensureRouteNotCached("/|!(**/*.{js,png,jpg,jpeg})");
        } else {
          cy.ensureRouteNotCached(path);
        }

        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.visit(path);
      });

      ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"].forEach(
        (method) => {
          it(`allows HTTP method for path ${path}: ${method}`, () => {
            cy.request({ url: path, method: method }).then((response) => {
              if (method !== "HEAD") {
                cy.verifyResponseIsCompressed(response);
              }
              expect(response.status).to.equal(200);
            });
          });
        }
      );
    });
  });

  describe("SSG pages", () => {
    [
      { path: "/ssg-page" },
      { path: "/en/ssg-page" },
      { path: "/fr/ssg-page" }
    ].forEach(({ path }) => {
      it(`serves and caches page ${path}`, () => {
        cy.visit(path);

        // Next.js currently behaves inconsistently here,
        // dropping the default locale for static pages
        if (path === "/en/ssg-page") {
          cy.location("pathname").should("eq", "/ssg-page");
        } else {
          cy.location("pathname").should("eq", path);
        }

        cy.ensureRouteCached(path);
        cy.visit(path);
      });

      it(`supports preview mode ${path}`, () => {
        cy.request("/api/preview/enabled");
        cy.getCookies().should("have.length", 2); // Preview cookies are now set
        // FIXME: Not sure why adding cy.ensureRouteNotCached(path) here fails as a preview response should be uncached?
        cy.visit(path);

        // Next.js currently behaves inconsistently here,
        // dropping the default locale for static pages
        if (path === "/en/ssg-page") {
          cy.location("pathname").should("eq", "/ssg-page");
        } else {
          cy.location("pathname").should("eq", path);
        }

        cy.get("[data-cy=preview-mode]").contains("true");

        cy.request("/api/preview/disabled");
        cy.getCookies().should("have.length", 0); // Preview cookies are now removed
        cy.ensureRouteCached(path);
        cy.visit(path);

        // Next.js currently behaves inconsistently here,
        // dropping the default locale for static pages
        if (path === "/en/ssg-page") {
          cy.location("pathname").should("eq", "/ssg-page");
        } else {
          cy.location("pathname").should("eq", path);
        }

        cy.get("[data-cy=preview-mode]").contains("false");
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${path}: ${method}`, () => {
          cy.request({ url: path, method: method }).then((response) => {
            expect(response.status).to.equal(200);
          });
        });
      });

      ["DELETE", "POST", "OPTIONS", "PUT", "PATCH"].forEach((method) => {
        it(`disallows HTTP method for path ${path} with 4xx error: ${method}`, () => {
          cy.request({
            url: path,
            method: method,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.be.at.least(400);
            expect(response.status).to.be.lessThan(500);
          });
        });
      });
    });
  });

  describe("404 pages", () => {
    [
      { path: "/unmatched" },
      { path: "/unmatched/nested" },
      { path: "/en/unmatched" },
      { path: "/en/unmatched/nested" },
      { path: "/fr/unmatched" },
      { path: "/fr/unmatched/nested" }
    ].forEach(({ path }) => {
      it(`serves 404 page ${path}`, () => {
        cy.ensureRouteHasStatusCode(path, 404);
        cy.visit(path, { failOnStatusCode: false });

        // Default Next.js 404 page
        cy.contains("404");
      });
    });
  });

  describe("Error pages", () => {
    [
      { path: "/errored-page" },
      { path: "/errored-page-new-ssr" },
      { path: "/en/errored-page" },
      { path: "/en/errored-page-new-ssr" },
      { path: "/fr/errored-page" },
      { path: "/fr/errored-page-new-ssr" }
    ].forEach(({ path }) => {
      it(`serves 500 page ${path}`, () => {
        cy.ensureRouteHasStatusCode(path, 500);
        cy.visit(path, { failOnStatusCode: false });

        // Default Next.js error page
        cy.contains("500");
      });
    });
  });
});
