describe("Rewrites Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Custom rewrites defined in next.config.js", () => {
    [
      {
        path: "/rewrite/",
        expectedRewrite: "/ssr-page/",
        expectedStatus: 200
      },
      {
        path: "/path-rewrite/123/",
        expectedRewrite: "/ssr-page/",
        expectedStatus: 200
      },
      {
        path: "/wildcard-rewrite/123/",
        expectedRewrite: "/ssr-page/",
        expectedStatus: 200
      },
      {
        path: "/regex-rewrite-1/123/",
        expectedRewrite: "/ssr-page/",
        expectedStatus: 200
      },
      {
        path: "/regex-rewrite-1/abc/", // regex only matches numbers
        expectedRewrite: null,
        expectedStatus: null
      },
      // No trailing slash for APIs
      {
        path: "/api/rewrite-basic-api",
        expectedRewrite: "/api/basic-api",
        expectedStatus: 200
      }
    ].forEach(({ path, expectedRewrite, expectedStatus }) => {
      it(`rewrites path ${path} to ${expectedRewrite}`, () => {
        if (expectedRewrite) {
          cy.request({
            url: path
          }).then((response) => {
            expect(response.status).to.equal(expectedStatus);
            cy.request({
              url: expectedRewrite
            }).then((rewriteResponse) => {
              // Check that the body of each page is the same, i.e it is actually rewritten
              expect(response.body).to.deep.equal(rewriteResponse.body);
            });
          });
        } else {
          // If no rewrite is expected, expect a 404 instead
          cy.request({
            url: path,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.equal(404);
          });
        }
      });
    });
  });
});
