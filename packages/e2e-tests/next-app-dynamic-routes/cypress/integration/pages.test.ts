describe("Pages Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Dynamic Pages with getStaticPaths()", () => {
    [{ path: "/a" }, { path: "/b" }].forEach(({ path }) => {
      it(`serves and caches page ${path}`, () => {
        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.ensureRouteCached(path);
        cy.visit(path);
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${path}: ${method}`, () => {
          cy.request({ url: path, method: method }).then((response) => {
            expect(response.status).to.equal(200);
          });
        });
      });

      ["DELETE", "POST", "OPTIONS", "PUT", "PATCH"].forEach((method) => {
        it(`disallows HTTP method for path ${path} with 4xx error: ${method}`, () => {
          cy.request({
            url: path,
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

  describe("Catch-all SSR Page", () => {
    [{ path: "/a/b" }].forEach(({ path }) => {
      it(`serves and caches page ${path}`, () => {
        cy.ensureRouteNotCached(path);

        cy.visit(path);
        cy.location("pathname").should("eq", path);
      });

      ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"].forEach(
        (method) => {
          it(`allows HTTP method for path ${path}: ${method}`, () => {
            cy.request({ url: path, method: method }).then((response) => {
              expect(response.status).to.equal(200);
            });
          });
        }
      );
    });
  });
});
