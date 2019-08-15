const manifest = require("./manifest.json");

exports.handler = async event => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const { pages, cloudFrontOrigins, publicFiles } = manifest;

  const isStaticPage = pages.static[uri];
  const isPublicFile = publicFiles[uri];

  let host = cloudFrontOrigins.ssrApi.domainName;

  if (isStaticPage || isPublicFile) {
    // serve static page or public file from S3
    request.origin = {
      static: {
        authMethod: "origin-access-identity",
        domainName: cloudFrontOrigins.staticOrigin.domainName,
        path: isStaticPage ? "/static-pages" : "/public-files"
      }
    };

    host = cloudFrontOrigins.staticOrigin.domainName;

    if (isStaticPage) {
      request.uri = request.uri + ".html";
    }
  }

  request.headers.host = {
    key: "host",
    value: host
  };

  return request;
};
