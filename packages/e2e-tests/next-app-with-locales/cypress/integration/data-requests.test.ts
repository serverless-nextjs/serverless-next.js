describe("Data Requests", () => {
  const buildId = Cypress.env("NEXT_BUILD_ID");

  describe("SSG data requests", () => {
    [
      { path: "/ssg-page.json" },
      { path: "/en/ssg-page.json" },
      { path: "/fr/ssg-page.json" },
      { path: "/en.json" },
      { path: "/fr.json" }
    ].forEach(({ path }) => {
      const fullPath = `/_next/data/${buildId}${path}`;

      it(`serves the SSG data request for path ${fullPath}`, () => {
        // Hit two times, and check that the response should definitely be cached after 2nd time
        for (let i = 0; i < 2; i++) {
          cy.request(fullPath).then((response) => {
            expect(response.status).to.equal(200);
            expect(response.headers["cache-control"]).to.not.be.undefined;

            if (i === 1) {
              cy.verifyResponseCacheStatus(response, true);
            } else {
              expect(response.headers["x-cache"]).to.be.oneOf([
                "Miss from cloudfront",
                "Hit from cloudfront"
              ]);
            }
          });
        }
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${fullPath}: ${method}`, () => {
          cy.request({ url: fullPath, method: method }).then((response) => {
            expect(response.status).to.equal(200);
          });
        });
      });

      ["DELETE", "POST", "OPTIONS", "PUT", "PATCH"].forEach((method) => {
        it(`disallows HTTP method for path ${fullPath} with 4xx error: ${method}`, () => {
          cy.request({
            url: fullPath,
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

  describe("SSR data requests", () => {
    [
      { path: "/ssr-page-2.json" },
      { path: "/en/ssr-page-2.json" },
      { path: "/fr/ssr-page-2.json" }
    ].forEach(({ path }) => {
      const fullPath = `/_next/data/${buildId}${path}`;

      it(`serves the SSR data request for path ${fullPath}`, () => {
        // Hit two times, both of which, the response should not be cached
        for (let i = 0; i < 2; i++) {
          cy.request(fullPath).then((response) => {
            expect(response.status).to.equal(200);
            cy.verifyResponseCacheStatus(response, false);
            expect(response.headers["cache-control"]).to.be.undefined;
          });
        }
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${fullPath}: ${method}`, () => {
          cy.request({ url: fullPath, method: method }).then((response) => {
            expect(response.status).to.equal(200);
          });
        });
      });

      ["DELETE", "POST", "OPTIONS", "PUT", "PATCH"].forEach((method) => {
        it(`disallows HTTP method for path ${fullPath} with 4xx error: ${method}`, () => {
          cy.request({
            url: fullPath,
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
});
