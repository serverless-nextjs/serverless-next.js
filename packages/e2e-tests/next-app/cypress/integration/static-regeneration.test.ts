describe("ISR Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  // We don't want this test to retry as the cache will not be expired between
  // runs
  describe("SSG page", { retries: 0 }, () => {
    [
      "/revalidated-ssg-page",
      // Pre-rendered ISR page
      "/revalidated-ssg-pages/101",
      // Blocking dynamic generated page
      "/revalidated-ssg-pages/105"
    ].forEach((path) => {
      it(`serves the cached re-rendered page "${path}" after 2 reloads`, () => {
        // The initial load will have expired in the cache
        cy.ensureRouteNotCached(path);
        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.get("[data-cy=date-text]")
          .invoke("text")
          .then((text1) => {
            // When we reload again the page still should not be cached as this
            // should be the first time its being served from the origin
            cy.ensureRouteNotCached(path);
            cy.reload();
            cy.get("[data-cy=date-text]")
              .invoke("text")
              .then((text2) => {
                // Check that the date text has changed since the initial page
                // load
                expect(text1).not.to.be.eq(text2);
                // The new date should be greater than the original
                expect(new Date(text2).getTime()).to.be.greaterThan(
                  new Date(text1).getTime()
                );
                // Make sure the next load is cached
                cy.ensureRouteCached(path);
                // Be sure that the regeneration has run and uploaded the file
                cy.wait(2000);
                cy.reload();
              });
          });

        // Wait for the cache to expire after the 10s
        cy.wait(8000);
        cy.ensureRouteNotCached(path);
        cy.reload();
      });
    });
  });
});
