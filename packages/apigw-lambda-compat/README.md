# API Gateway Lambda Compat

Compat layer between next.js serverless page and API Gateway => Lambda Proxy Integration.

Lambda Proxy Integration event structure documentation can be found [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html).

## Installation

`npm install next-aws-lambda`

## Usage

```js
const compat = require("next-aws-lambda");
const page = require(".next/serverless/pages/somePage.js");

// using callback

module.exports.render = (event, context, callback) => {
  compat(page)(event, context, callback);
};

// using async promise

module.exports.render = async (event, context) => {
  const responsePromise = compat(page)(event, context); // don't pass the callback parameter
  return responsePromise;
};
```
