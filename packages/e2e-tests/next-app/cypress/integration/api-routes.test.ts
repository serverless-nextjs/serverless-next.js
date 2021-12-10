describe("API Routes Tests", () => {
  before(() => {
    cy.ensureAllRoutesNotErrored();
  });

  describe("Basic API", () => {
    const path = "/api/basic-api";

    ["DELETE", "POST", "GET", "PUT", "PATCH", "OPTIONS", "HEAD"].forEach(
      (method) => {
        it(`serves API request for path ${path} and method ${method}`, () => {
          cy.request({ url: path, method: method }).then((response) => {
            expect(response.status).to.equal(200);
            cy.verifyResponseCacheStatus(response, false);

            if (method === "HEAD") {
              expect(response.body).to.be.empty;
            } else {
              expect(response.body).to.deep.equal({
                name: "This is a basic API route.",
                method: method,
                body: ""
              });
            }
          });
        });
      }
    );
  });

  describe("Dynamic + Nested API", () => {
    const base = "api/nested/";

    ["DELETE", "POST", "GET", "PUT", "PATCH", "OPTIONS", "HEAD"].forEach(
      (method) => {
        const id = "1";
        const path = base + id;

        it(`serves API request for path ${path} and method ${method}`, () => {
          cy.request({ url: path, method: method }).then((response) => {
            expect(response.status).to.equal(200);
            cy.verifyResponseCacheStatus(response, false);

            if (method === "HEAD") {
              expect(response.body).to.be.empty;
            } else {
              expect(response.body).to.deep.equal({
                id: id,
                name: `User ${id}`,
                method: method
              });
            }
          });
        });
      }
    );

    ["1", "2", "3", "4", "5"].forEach((id) => {
      const path = base + id;
      it(`serves API request for path ${path} for different IDs`, () => {
        cy.request({ url: path, method: "GET" }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.deep.equal({
            id: id,
            name: `User ${id}`,
            method: "GET"
          });
          cy.verifyResponseCacheStatus(response, false);
        });
      });
    });
  });
});
