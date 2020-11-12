describe("Headers Tests", () => {
  describe("Custom headers defined in next.config.js", () => {
    [
      {
        path: "/ssr-page/",
        expectedHeaders: { "x-custom-header-ssr-page": "custom" }
      },
      {
        path: "/ssg-page/",
        expectedHeaders: { "x-custom-header-ssg-page": "custom" }
      },
      {
        path: "/",
        expectedHeaders: { "x-custom-header-all": "custom" }
      },
      // No trailing slash for API or public file routes
      {
        path: "/api/basic-api",
        expectedHeaders: { "x-custom-header-api": "custom" }
      },
      {
        path: "/app-store-badge.png",
        expectedHeaders: { "x-custom-header-public-file": "custom" }
      }
    ].forEach(({ path, expectedHeaders }) => {
      it(`add headers ${JSON.stringify(
        expectedHeaders
      )} for path ${path}`, () => {
        cy.request({
          url: path,
          failOnStatusCode: false
        }).then((response) => {
          for (const expectedHeader in expectedHeaders) {
            expect(response.headers[expectedHeader]).to.equal(
              expectedHeaders[expectedHeader]
            );
          }
        });
      });
    });
  });
});
