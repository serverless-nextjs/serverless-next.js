describe("Headers Tests", () => {
  describe("Custom headers defined in next.config.js", () => {
    [
      {
        path: "/basepath/ssr-page",
        expectedHeaders: { "x-custom-header-ssr-page": "custom" }
      },
      // {
      //   path: "/basepath/ssg-page",
      //   expectedHeaders: { "x-custom-header-ssg-page": "custom" }
      // },
      {
        path: "/basepath",
        expectedHeaders: { "x-custom-header-all": "custom" }
      },
      {
        path: "/basepath/api/basic-api",
        expectedHeaders: { "x-custom-header-api": "custom" }
      }
      // {
      //   path: "/basepath/app-store-badge.png",
      //   expectedHeaders: { "x-custom-header-public-file": "custom" }
      // }
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
