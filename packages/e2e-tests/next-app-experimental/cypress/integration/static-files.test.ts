describe("Static Files Tests", () => {
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

  describe("public files", () => {
    [
      {
        path: "/app-store-badge.png",
        contentType: "image/png",
        cacheable: true
      },
      { path: "/example.html", contentType: "text/html", cacheable: false },
      {
        path: "/.well-known/test.txt",
        contentType: "text/plain",
        cacheable: false
      }
    ].forEach(({ path, contentType, cacheable }) => {
      it(`serves file ${path} for content type ${contentType} and cacheable: ${cacheable}`, () => {
        // Request once to ensure cached
        cy.request(path);
        cy.request(path).then((response) => {
          expect(response.headers["content-type"]).to.equal(contentType);
          expect(response.status).to.equal(200);
          cy.verifyResponseCacheStatus(response, cacheable);
        });
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${path}: ${method}`, () => {
          cy.request({ url: path, method: method }).then((response) => {
            expect(response.status).to.equal(200);
          });
        });
      });

      ["DELETE", "POST", "OPTIONS", "PUT", "PATCH"].forEach((method) => {
        it(`allows HTTP method for path ${path} with 2xx status: ${method}`, () => {
          cy.request({
            url: path,
            method: method
          }).then((response) => {
            expect(response.status).to.be.at.least(200);
            expect(response.status).to.be.lessThan(300);
          });
        });
      });
    });

    [
      {
        path: "/ignored.txt"
      }
    ].forEach(({ path }) => {
      it(`ignored file in serverless.yml returns 404 status code: ${path}`, () => {
        cy.request({ url: path, method: "GET", failOnStatusCode: false }).then(
          (response) => {
            expect(response.status).to.equal(404);
          }
        );
      });
    });
  });
});
