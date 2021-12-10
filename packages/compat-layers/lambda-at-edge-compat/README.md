# Next AWS CloudFront

Compat layer between next.js serverless page and CloudFront => Lambda@Edge.

Lambda@Edge event structure documentation can be found [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html).

## Installation

`npm install next-aws-cloudfront`

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

## Options

### Gzip compression

```js
const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf, {
  enableHTTPCompression: true // false by default
});
```
