## Description

Example nextjs serverless app with instances for both "staging" and "prod". The idea behind this example is to use the [@serverless/template](https://github.com/serverless/template) component to load the yml template in a JavaScript component. The JavaScript component can then programmatically inject any environment variable. In the example, the JavaScript component uses [dotenv](https://www.npmjs.com/package/dotenv) to inject either `env-staging` or `env-prod` (depending on stage).

## Getting started

Install serverless-next.js component dependency

```bash
cd ../../
npm install
```

Install example project deps:

`npm install`

Rename `.env.sample` to `.env` and set your aws credentials.

 1. To install a *staging* instance: `npm run deployStaging`.
 2. To install a *prod* instance: `npm run deployProd`.
