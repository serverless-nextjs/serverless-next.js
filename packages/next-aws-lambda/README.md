# Next AWS Lambda

Compat layer between next.js serverless page and AWS Lambda.

## Usage

```js
const compat = require("next-aws-lambda");
const page = require(".next/serverless/pages/somePage.js");

// using callback

module.exports.render = (event, context, callback) => {
  compat(page)(event, context, callback);
};

// using async promise

module.exports.render = async (event, context, callback) => {
  const responsePromise = compat(page)(event, context); // don't pass the callback parameter
  return responsePromise;
};
```
