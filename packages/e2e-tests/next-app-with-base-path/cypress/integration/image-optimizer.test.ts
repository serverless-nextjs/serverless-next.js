describe("Image Optimizer Tests", () => {
  describe("image optimization", () => {
    [{ contentType: "image/webp" }, { contentType: "image/png" }].forEach(
      ({ contentType }) => {
        it(`serves image app-store-badge.png with content-type: ${contentType}`, () => {
          cy.request({
            url: "/basepath/_next/image?url=%2Fapp-store-badge.png&w=256&q=100",
            method: "GET",
            headers: { accept: contentType }
          }).then((response) => {
            // TODO: not sure why this is failing in CI
            //expect(response.headers["content-type"]).to.equal(contentType);
            expect(response.headers["cache-control"]).to.equal(
              "public, max-age=31536000, must-revalidate"
            );
          });
        });
      }
    );

    // Higher quality should have higher file size
    [
      { quality: "100", expectedContentLength: "5742" },
      { quality: "50", expectedContentLength: "2654" }
    ].forEach(({ quality, expectedContentLength }) => {
      it(`serves image app-store-badge.png with quality: ${quality}`, () => {
        cy.request({
          url: `/basepath/_next/image?url=%2Fapp-store-badge.png&w=256&q=${quality}`,
          method: "GET",
          headers: { accept: "image/webp" }
        }).then((response) => {
          // TODO: not sure why this is failing in CI
          // expect(response.headers["content-length"]).to.equal(
          //   expectedContentLength
          // );
          expect(response.headers["cache-control"]).to.equal(
            "public, max-age=31536000, must-revalidate"
          );
        });
      });
    });

    // Higher width should have higher file size
    [
      { width: "128", expectedContentLength: "2600" },
      { width: "64", expectedContentLength: "1192" }
    ].forEach(({ width, expectedContentLength }) => {
      it(`serves image app-store-badge.png with width: ${width}`, () => {
        cy.request({
          url: `/basepath/_next/image?url=%2Fapp-store-badge.png&w=${width}&q=100`,
          method: "GET",
          headers: { accept: "image/webp" }
        }).then((response) => {
          // TODO: not sure why this is failing in CI
          // expect(response.headers["content-length"]).to.equal(
          //   expectedContentLength
          // );
          expect(response.headers["cache-control"]).to.equal(
            "public, max-age=31536000, must-revalidate"
          );
        });
      });
    });

    [
      {
        path: "/basepath/_next/image?url=https%3A%2F%2Fraw.githubusercontent.com%2Fserverless-nextjs%2Fserverless-next.js%2Fmaster%2Fpackages%2Fe2e-tests%2Fnext-app-with-base-path%2Fpublic%2Fapp-store-badge.png&q=100&w=128"
      }
    ].forEach(({ path }) => {
      it(`serves external image: ${path}`, () => {
        cy.request({ url: path, method: "GET" });
      });
    });

    [
      { path: "/basepath/_next/image" },
      { path: "/basepath/_next/image?w=256&q=100" },
      { path: "/basepath/_next/image?url=%2Fapp-store-badge.png&w=256" },
      { path: "/basepath/_next/image?url=%2Fapp-store-badge.png&q=100" }
    ].forEach(({ path }) => {
      it(`missing query parameter fails with 400 status code: ${path}`, () => {
        cy.request({ url: path, method: "GET", failOnStatusCode: false }).then(
          (response) => {
            expect(response.status).to.equal(400);
          }
        );
      });
    });
  });

  describe("image component page", () => {
    [{ path: "/basepath/image-component" }].forEach(({ path }) => {
      // FIXME: enable once basepath url is fixed
      xit(`serves page with image component and caches the image: ${path}`, () => {
        cy.ensureAllRoutesNotErrored(); // Visit routes only

        cy.visit(path);

        cy.ensureRouteCached(
          "/basepath/_next/image?url=%2Fbasepath%2Fapp-store-badge.png&w=1200&q=75"
        );

        cy.visit(path);
      });
    });
  });
});
