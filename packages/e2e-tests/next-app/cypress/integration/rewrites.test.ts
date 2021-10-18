describe("Rewrites Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Custom rewrites defined in next.config.js", () => {
    [
      {
        path: "/rewrite",
        expectedRewrite: "/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/rewrite?a=b",
        expectedRewrite: "/ssr-page?a=b",
        expectedStatus: 200
      },
      {
        path: "/path-rewrite/123",
        expectedRewrite: "/ssr-page?slug=123",
        expectedStatus: 200
      },
      {
        path: "/wildcard-rewrite/123/456",
        expectedRewrite: "/ssr-page?slug=123&slug=456",
        expectedStatus: 200
      },
      {
        path: "/regex-rewrite-1/123",
        expectedRewrite: "/ssr-page?slug=123",
        expectedStatus: 200
      },
      {
        path: "/regex-rewrite-1/abc", // regex only matches numbers
        expectedRewrite: null,
        expectedStatus: null
      },
      {
        path: "/api/rewrite-basic-api",
        expectedRewrite: "/api/basic-api",
        expectedStatus: 200
      },
      {
        path: "/ssr-page",
        expectedRewrite: "/ssr-page",
        expectedStatus: 200
      },
      {
        path: "/ssg-page",
        expectedRewrite: "/ssg-page",
        expectedStatus: 200
      },
      {
        path: "/app-store-badge.png",
        expectedRewrite: "/app-store-badge.png",
        expectedStatus: 200
      },
      {
        // Not rewritten since it's a non-dynamic route
        path: "/api/basic-api",
        expectedRewrite: "/api/basic-api",
        expectedStatus: 200
      },
      {
        path: "/rewrite-dest-with-query",
        expectedRewrite: "/ssr-page?foo=bar",
        expectedStatus: 200
      },
      {
        path: "/rewrite-dest-with-query?a=b",
        expectedRewrite: "/ssr-page?a=b&foo=bar",
        expectedStatus: 200
      },
      {
        path: "/no-op-rewrite",
        expectedRewrite: "/ssr-page",
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

    [
      {
        path: "/external-rewrite",
        expectedRewrite: "https://jsonplaceholder.typicode.com/users",
        method: "GET",
        expectedStatus: 200
      },
      {
        path: "/api/external-rewrite",
        expectedRewrite: "https://jsonplaceholder.typicode.com/users",
        method: "GET",
        expectedStatus: 200
      },
      {
        path: "/api/external-rewrite",
        expectedRewrite: "https://jsonplaceholder.typicode.com/users",
        method: "POST",
        body: '{ "hello": "world" }', // Check that body can passed to external rewrite
        expectedStatus: 201
      },
      {
        path: "/external-rewrite-issues?page=1",
        expectedRewrite: "https://jsonplaceholder.typicode.com/todos?page=1",
        method: "GET",
        body: undefined,
        expectedStatus: 200
      },
      {
        path: "/external-rewrite-issues-with-query?page=1",
        expectedRewrite: "https://jsonplaceholder.typicode.com/todos?page=1",
        method: "GET",
        body: undefined,
        expectedStatus: 200
      },
      {
        path: "/api/external-rewrite-issues?page=1",
        expectedRewrite: "https://jsonplaceholder.typicode.com/todos?page=1",
        method: "GET",
        body: undefined,
        expectedStatus: 200
      },
      {
        path: "/api/external-rewrite-issues-with-query?page=1",
        expectedRewrite: "https://jsonplaceholder.typicode.com/todos?page=1",
        method: "GET",
        body: undefined,
        expectedStatus: 200
      }
    ].forEach(({ path, expectedRewrite, method, body, expectedStatus }) => {
      it(`externally rewrites path ${path} to ${expectedRewrite} for method ${method}`, () => {
        cy.request({
          url: path,
          method: method,
          body: body,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.equal(expectedStatus);
          cy.request({
            url: expectedRewrite,
            method: method,
            body: body,
            failOnStatusCode: false
          }).then((rewriteResponse) => {
            // Check that the body of each page is the same, i.e it is actually rewritten
            expect(response.body).to.deep.equal(rewriteResponse.body);
          });
        });
      });
    });

    it("externally rewrites to /api/basic-api with correct method, body and forwarded auth headers", () => {
      cy.request({
        url: "/api/external-rewrite-internal-api",
        method: "POST",
        body: "blah",
        failOnStatusCode: false,
        headers: { Authorization: `Bearer 12345` }
      }).then((response) => {
        expect(response.status).to.equal(200);

        // body should be the same as /api/basic-api
        expect(response.body).to.deep.equal({
          name: "This is a basic API route.",
          method: "POST",
          body: "blah",
          authorization: "Bearer 12345" // authorization header is forwarded via CF, and external rewrite should forward it as well
        });
      });
    });
  });
});
