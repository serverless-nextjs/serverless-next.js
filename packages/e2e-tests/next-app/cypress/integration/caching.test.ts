describe("Caching Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("all static file requests for a page are cached", () => {
    [{ path: "/" }].forEach(({ path }) => {
      it(`serves and caches all static files for page ${path}`, () => {
        // Visit page once to ensure files are cached in CloudFront
        cy.visit(path);

        cy.visit(path);
        // TODO: figure out how to grab all static files from page
        // and verify they are cached, since Cypress route intercepting does not
        // seem to work on static file requests after page visit.
      });
    });
  });

  describe("public files are cached", () => {
    [{ path: "/app-store-badge.png" }].forEach(({ path }) => {
      it(`serves and caches file ${path}`, () => {
        // Request once to ensure cached
        cy.request(path);
        cy.request(path).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.headers["x-cache"]).to.equal("Hit from cloudfront");
        });
      });
    });
  });
});
