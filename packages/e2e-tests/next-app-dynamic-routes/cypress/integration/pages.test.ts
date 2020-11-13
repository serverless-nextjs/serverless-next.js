describe("Pages Tests", () => {
  const buildId = Cypress.env("NEXT_BUILD_ID");

  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Dynamic Page at root level with getStaticPaths() fallback: true", () => {
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

    it("serves non-dynamic SSG page at same level", () => {
      const path = "/ssg-page";

      cy.request({
        url: path
      }).then((response) => {
        expect(response.body).to.contain("SSG Page");
      });
    });

    it("serves non-dynamic SSR page at same level", () => {
      const path = "/ssr-page";

      cy.request({
        url: path
      }).then((response) => {
        expect(response.body).to.contain("SSR Page");
      });
    });
  });

  describe("Nested Dynamic Page with getStaticPaths() fallback: false", () => {
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

        cy.request(path).then((response) => {
          expect(response.body).to.contain("catch-all-ssr");
        });
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

  describe("Optional catch-all SSR Page", () => {
    [
      { path: "/optional-catch-all-ssr" },
      { path: "/optional-catch-all-ssr/a" },
      { path: "/optional-catch-all-ssr/b" }
    ].forEach(({ path }) => {
      const param = path
        .replace("/optional-catch-all-ssr", "")
        .replace("/", "");

      it(`serves and caches page ${path}`, () => {
        cy.ensureRouteNotCached(path);

        cy.visit(path);
        cy.contains("optional-catch-all-ssr");
        cy.location("pathname").should("eq", path);

        // Make sure page itself is SSR'd and contains the dynamic parameter on initial response
        cy.request(path).then((response) => {
          expect(response.body).to.contain("optional-catch-all-ssr");
          expect(response.body).to.contain(`<p data-cy="catch">${param}</p>`);
        });
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

      it(`serves data request for ${path}`, () => {
        const fullPath = `/_next/data/${buildId}${path}`;

        cy.request({ url: fullPath, method: "GET" }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.deep.equal({
            pageProps: {
              name: "serverless-next.js",
              catch: param
            },
            __N_SSP: true
          });
        });
      });
    });
  });

  describe("Dynamic SSR page", () => {
    [{ path: "/another/1234" }].forEach(({ path }) => {
      it(`serves and caches page ${path}`, () => {
        cy.ensureRouteNotCached(path);

        cy.visit(path);
        cy.location("pathname").should("eq", path);

        cy.request(path).then((response) => {
          expect(response.body).to.contain("dynamic-ssr");
        });
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

    [{ path: "/another/ssg-prioritized-over-dynamic-ssr" }].forEach(
      ({ path }) => {
        it(`serves and caches page ${path}`, () => {
          cy.visit(path);

          cy.ensureRouteCached(path);

          cy.visit(path);
          cy.location("pathname").should("eq", path);

          cy.request(path).then((response) => {
            expect(response.body).to.contain(
              "ssg-prioritized-over-dynamic-ssr"
            );
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
      }
    );
  });
});
