describe("Redirects Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Pages redirect to non-trailing slash path", () => {
    [
      { path: "/ssr-page/" },
      { path: "/ssg-page/" },
      { path: "/errored-page/" },
      { path: "/errored-page-new-ssr/" },
      { path: "/unmatched/" }
    ].forEach(({ path }) => {
      it(`redirects page ${path}`, () => {
        cy.ensureRouteHasStatusCode(path, 308);

        const redirectedPath = path.slice(0, -1);

        // Verify redirect response
        cy.verifyPermanentRedirect(path, redirectedPath);

        // Visit to follow redirect
        cy.visit(path, { failOnStatusCode: false });
        cy.location("pathname").should("eq", redirectedPath);
      });
    });
  });

  describe("Public files always redirect to non-trailing slash path", () => {
    [{ path: "/app-store-badge.png/" }].forEach(({ path }) => {
      it(`redirects file ${path}`, () => {
        const redirectedPath = path.slice(0, -1);

        // Verify redirect response
        cy.verifyPermanentRedirect(path, redirectedPath);

        // We can't use visit to follow redirect as it expects HTML content, not files.
        cy.request(path).then((response) => {
          expect(response.status).to.equal(200);
        });
      });
    });
  });
});
