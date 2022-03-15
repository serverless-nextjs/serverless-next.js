describe("ISR Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });
  describe("SSG Redirect", () => {
    it("non existing user redirects to home", () => {
      const path = "/en/revalidated-ssg-pages/106";
      cy.request({ url: path }).then((response) => {
        expect(response.status).to.equal(200);

        const redirectedPath = "/";
        // Verify redirect response
        expect(response.body).to.deep.equal({
          pageProps: {
            __N_REDIRECT: redirectedPath,
            __N_REDIRECT_STATUS: 307
          },
          __N_SSG: true
        });
      });
    });
  });
  describe("SSG page", () => {
    [
      { path: "/revalidated-ssg-page", initialWaitSeconds: 0 },
      // Pre-rendered ISR page
      { path: "/revalidated-ssg-pages/101", initialWaitSeconds: 0 },
      // Blocking dynamic generated page. As the page will be created and cached
      // on first request, we'll need to wait another 10+1 seconds to be sure
      // that we have exceeded the revalidate window.
      { path: "/revalidated-ssg-pages/105", initialWaitSeconds: 11 },
      { path: "/en-GB/revalidated-ssg-page", initialWaitSeconds: 0 },
      // Pre-rendered ISR page
      { path: "/en-GB/revalidated-ssg-pages/101", initialWaitSeconds: 0 },
      // Blocking dynamic generated page. As the page will be created and cached
      // on first request, we'll need to wait another 10+1 seconds to be sure
      // that we have exceeded the revalidate window.
      { path: "/en-GB/revalidated-ssg-pages/105", initialWaitSeconds: 11 },
      { path: "/fr/revalidated-ssg-page", initialWaitSeconds: 0 },
      // Pre-rendered ISR page
      { path: "/fr/revalidated-ssg-pages/101", initialWaitSeconds: 0 },
      // Blocking dynamic generated page. As the page will be created and cached
      // on first request, we'll need to wait another 10+1 seconds to be sure
      // that we have exceeded the revalidate window.
      { path: "/fr/revalidated-ssg-pages/105", initialWaitSeconds: 11 }
    ].forEach(({ path, initialWaitSeconds }) => {
      it(`serves the cached re-rendered page "${path}" after 2 reloads`, () => {
        // https://docs.cypress.io/guides/guides/test-retries#Can-I-access-the-current-attempt-counter-from-the-test
        const attempt = Cypress._.get(
          (cy as any).state("runnable"),
          "_currentRetry",
          0
        );

        if (attempt) {
          // In retries we wait to ensure consistent, expired state
          cy.wait(11000);
        } else if (initialWaitSeconds) {
          // Here the page has never been generated
          cy.ensureRouteNotCached(path);
          cy.visit(path);
          cy.wait(initialWaitSeconds * 1000);
        }

        // The initial load will have expired in the cache
        cy.ensureRouteNotCached(path);
        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.get("[data-cy=date-text]")
          .invoke("text")
          .then((text1) => {
            // Be sure that the regeneration has run and uploaded the file
            cy.wait(4000);
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
                cy.reload();
              });
          });

        // Wait for the cache to expire after the 10s
        cy.wait(10000);
        cy.ensureRouteNotCached(path);
        cy.reload();
      });
    });
  });
});
