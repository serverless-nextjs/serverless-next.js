const manifest = require("./manifest.json");
const cloudFrontCompat = require("./next-aws-cloudfront");
const router = require("./router");

exports.handler = async event => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const { pages, cloudFrontOrigins, publicFiles } = manifest;

  const isStaticPage = pages.html[uri];
  const isPublicFile = publicFiles[uri];

  let host = cloudFrontOrigins.ssrApi.domainName;

  if (isStaticPage || isPublicFile) {
    // serve static page or public file from S3
    request.origin = {
      s3: {
        authMethod: "none",
        domainName: cloudFrontOrigins.staticOrigin.domainName,
        path: isStaticPage ? "/static-pages" : "/public"
      }
    };

    host = cloudFrontOrigins.staticOrigin.domainName;

    if (isStaticPage) {
      request.uri = request.uri + ".html";
    }
  } else if (manifest.ssrOptimisationEnabled) {
    const pagePath = router(manifest)(uri);

    if (!pagePath.includes("_error.js")) {
      const page = require(pagePath);
      const { req, res, responsePromise } = cloudFrontCompat(
        event.Records[0].cf
      );
      page.render(req, res);
      return responsePromise;
    }
  }

  request.headers.host = [
    {
      key: "host",
      value: host
    }
  ];

  return request;
};
