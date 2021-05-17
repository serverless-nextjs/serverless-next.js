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

      it(`serves data request for ${path}`, () => {
        const fullPath = `/_next/data/${buildId}${path.replace(
          /\/$/,
          "/index"
        )}.json`;
        const dataRequestParam = path.replace("/", "");

        cy.request({ url: fullPath, method: "GET" }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.deep.equal({
            pageProps: { name: "serverless-next.js", catch: dataRequestParam },
            __N_SSP: true
          });
        });
      });
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
        const fullPath = `/_next/data/${buildId}${path.replace(
          /\/$/,
          "/index"
        )}.json`;

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

  describe("Optional catch-all SSG Page with fallback: false", () => {
    [
      { path: "/optional-catch-all-ssg-no-fallback" },
      { path: "/optional-catch-all-ssg-no-fallback/a" },
      { path: "/optional-catch-all-ssg-no-fallback/b" }
    ].forEach(({ path }) => {
      const param = path
        .replace("/optional-catch-all-ssg-no-fallback", "")
        .replace("/", "");

      it(`serves and caches page ${path}`, () => {
        cy.visit(path);
        cy.contains("optional-catch-all-ssg-no-fallback");
        cy.location("pathname").should("eq", path);

        cy.ensureRouteCached(path);
        cy.visit(path);

        // Make sure page itself is SSG'd and contains the pre-built parameter in initial response
        cy.request(path).then((response) => {
          expect(response.body).to.contain(
            "optional-catch-all-ssg-no-fallback"
          );
          expect(response.body).to.contain(`<p data-cy="catch">${param}</p>`);
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
        it(`disallows HTTP method for path ${path} with 4xx error ${method}`, () => {
          cy.request({
            url: path,
            method: method,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.be.gte(400);
          });
        });
      });

      it(`serves data request for ${path}`, () => {
        const fullPath = `/_next/data/${buildId}${path.replace(
          /\/$/,
          "/index"
        )}.json`;

        cy.request({ url: fullPath, method: "GET" }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.deep.equal({
            pageProps: { name: "serverless-next.js", catch: param },
            __N_SSG: true
          });
        });
      });
    });

    [{ path: "/optional-catch-all-ssg-no-fallback/not-found" }].forEach(
      ({ path }) => {
        const param = path
          .replace("/optional-catch-all-ssg-no-fallback", "")
          .replace("/", "");

        ["HEAD", "GET"].forEach((method) => {
          it(`allows HTTP method for path ${path}: ${method} and returns 404 status`, () => {
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
          it(`disallows HTTP method for path ${path} with 4xx status code: ${method}`, () => {
            cy.request({
              url: path,
              method: method,
              failOnStatusCode: false
            }).then((response) => {
              expect(response.status).to.be.gte(400);
            });
          });
        });

        it(`serve data request for ${path}`, () => {
          // TODO: page itself is 404 but data request can still be served if requested.
          const fullPath = `/_next/data/${buildId}${path.replace(
            /\/$/,
            "/index"
          )}.json`;

          cy.request({
            url: fullPath,
            method: "GET"
          }).then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal({
              pageProps: { name: "serverless-next.js", catch: param },
              __N_SSG: true
            });
          });
        });
      }
    );
  });

  describe("Optional catch-all SSG Page with fallback: true", () => {
    [
      {
        path: "/optional-catch-all-ssg-with-fallback",
        param: "",
        prerendered: true
      },
      {
        path: "/optional-catch-all-ssg-with-fallback/a",
        param: "a",
        prerendered: true
      },
      {
        path: "/optional-catch-all-ssg-with-fallback/b",
        param: "b",
        prerendered: true
      },
      {
        path: "/optional-catch-all-ssg-with-fallback/not-found",
        param: "",
        prerendered: false
      }
    ].forEach(({ path, param, prerendered }) => {
      it(`serves and caches page ${path}`, () => {
        cy.visit(path);
        cy.contains("optional-catch-all-ssg-with-fallback");
        cy.location("pathname").should("eq", path);

        cy.ensureRouteCached(path);
        cy.visit(path);

        // Make sure page itself is SSG'd and contains the pre-built parameter in initial response
        cy.request(path).then((response) => {
          expect(response.body).to.contain(
            "optional-catch-all-ssg-with-fallback"
          );
          if (prerendered) {
            expect(response.body).to.contain(`<p data-cy="catch">${param}</p>`);
          }
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
        it(`disallows HTTP method for path ${path} with 4xx error ${method}`, () => {
          cy.request({
            url: path,
            method: method,
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.be.gte(400);
          });
        });
      });

      it(`serves data request for ${path}`, () => {
        const fullPath = `/_next/data/${buildId}${path.replace(
          /\/$/,
          "/index"
        )}.json`;
        const dataRequestParam = path
          .replace("/optional-catch-all-ssg-with-fallback", "")
          .replace("/", "");

        cy.request({ url: fullPath, method: "GET" }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.deep.equal({
            pageProps: { name: "serverless-next.js", catch: dataRequestParam },
            __N_SSG: true
          });
        });

        // If not prerendered, check that the SSG data request gets cached on the 2nd time requested
        if (!prerendered) {
          cy.request({ url: fullPath, method: "GET" }).then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body).to.deep.equal({
              pageProps: {
                name: "serverless-next.js",
                catch: dataRequestParam
              },
              __N_SSG: true
            });

            cy.verifyResponseCacheStatus(response, true);
          });
        }
      });
    });

    [
      {
        path: "/optional-catch-all-ssg-with-fallback/not-prerendered",
        param: "not-prerendered"
      }
    ].forEach(({ path, param }) => {
      it(`serves but does not cache fallback page, then caches page ${path}`, () => {
        // Ensure we hit a new page
        const now = Date.now();
        const newPath = `${path}-${now}`;

        // Verify first request is to fallback page
        cy.request(newPath).then((response) => {
          expect(response.headers["cache-control"]).to.equal(
            "public, max-age=0, s-maxage=0, must-revalidate"
          );
          expect(response.body).to.contain('<p data-cy="catch"></p>');
        });

        // TODO: not sure why but I couldn't verify that subsequent request is the prerendered page, Cypress seemed to cache the fallback page response.
        //  However, verified manually that it works correctly.
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
