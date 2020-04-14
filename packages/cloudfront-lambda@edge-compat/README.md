# Next AWS CloudFront

Compat layer between next.js serverless page and AWS CloudFront Lambda@Edge.

## Usage

```js
const cloudFrontCompat = require("next-aws-cloudfront");
const page = require(".next/serverless/pages/somePage.js");

module.exports.render = async (event, context) => {
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);
  page.render(req, res);
  return responsePromise;
};
```
