describe("ISR Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  // We don't want this test to retry as the cache will not be expired between
  // runs
  describe("SSG page", { retries: 0 }, () => {
    it(`serves the cached re-rendered page after 2 reloads`, () => {
      // The initial load will have expired in the cache
      cy.ensureRouteNotCached("/revalidated-ssg-page");
      cy.visit("/revalidated-ssg-page");
      cy.location("pathname").should("eq", "/revalidated-ssg-page");

      cy.get("[data-cy=date-text]")
        .invoke("text")
        .then((text1) => {
          // When we reload again the page still should not be cached as this
          // should be the first time its being served from the origin
          cy.ensureRouteNotCached("/revalidated-ssg-page");
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
              cy.ensureRouteCached("/revalidated-ssg-page");
              // Be sure that the regeneration has run and uploaded the file
              cy.wait(2000);
              cy.reload();
            });
        });

      // Wait for the cache to expire after the 10s
      cy.wait(8000);
      cy.ensureRouteNotCached("/revalidated-ssg-page");
      cy.reload();
    });
  });
});
