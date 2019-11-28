const manifest = require("./manifest.json");
const cloudFrontCompat = require("./next-aws-cloudfront");

const normaliseUri = uri => (uri === "/" ? "/index" : uri);

const router = manifest => {
  const {
    apis: { dynamic, nonDynamic }
  } = manifest;

  return path => {
    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    for (let route in dynamic) {
      const { file, regex } = dynamic[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    return "pages/_error.js";
  };
};

exports.handler = async event => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);

  const pagePath = router(manifest)(uri);

  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);

  page.default(req, res);

  return responsePromise;
};
