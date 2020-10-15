describe("Pages Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Dynamic Pages with getStaticPaths() fallback: true", () => {
    [{ path: "/a" }, { path: "/b" }, { path: "/not-prerendered" }].forEach(
      ({ path }) => {
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
      }
    );
  });

  describe("Nested Dynamic Pages with getStaticPaths() fallback: false", () => {
    [{ path: "/nested/a" }, { path: "/nested/b" }].forEach(({ path }) => {
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

    [{ path: "/nested/not-prerendered" }].forEach(({ path }) => {
      it(`serves page ${path}`, () => {
        cy.visit(path, { failOnStatusCode: false });
        cy.location("pathname").should("eq", path);

        cy.visit(path, { failOnStatusCode: false });
      });

      ["HEAD", "GET"].forEach((method) => {
        it(`allows HTTP method for path ${path} and serves 404: ${method}`, () => {
          cy.request({
            url: path,
            method: method,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.equal(404);
            expect(response.headers["x-cache"]).to.equal(
              "Error from cloudfront"
            );
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
            expect(response.status).to.not.equal(404);
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
