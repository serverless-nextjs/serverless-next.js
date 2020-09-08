describe("Pages Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("SSR pages (getInitialProps)", () => {
    [{ path: "/ssr-page" }].forEach(({ path }) => {
      it(`serves but does not cache page ${path}`, () => {
        cy.ensureRouteNotCached(path);

        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.visit(path);
      });
    });
  });

  describe("SSR pages (getServerSideProps)", () => {
    [{ path: "/" }].forEach(({ path }) => {
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
    });
  });

  describe("SSG pages", () => {
    [{ path: "/ssg-page" }].forEach(({ path }) => {
      it(`serves and caches page ${path}`, () => {
        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.ensureRouteCached(path);
        cy.visit(path);
      });
    });
  });

  describe("404 pages", () => {
    [{ path: "/unmatched" }, { path: "/unmatched/nested" }].forEach(
      ({ path }) => {
        it(`serves 404 page ${path}`, () => {
          cy.ensureRouteHasStatusCode(path, 404);
          cy.visit(path, { failOnStatusCode: false });

          // Default Next.js 404 page
          cy.contains("404");
        });
      }
    );
  });

  describe("Error pages", () => {
    [{ path: "/errored-page" }, { path: "/errored-page-new-ssr" }].forEach(
      ({ path }) => {
        it(`serves 500 page ${path}`, () => {
          cy.ensureRouteHasStatusCode(path, 500);
          cy.visit(path, { failOnStatusCode: false });

          // Default Next.js error page
          cy.contains("500");
        });
      }
    );
  });
});
