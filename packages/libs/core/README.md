# @sls-next/core
> Core library for running serverless Next.js apps

This decouples the core Next.js handler logic from a particular platform.
The types defined are meant to be abstract to use with any provider.
It provides platform-agnostic handlers that can be extended for use on specific platforms.

Code coverage relies on jest configuration:

    "moduleNameMapper": {
      "@sls-next/core": "<rootDir>/packages/libs/core/src/index.ts"
    },

Builds twice, both a commonjs module (dist/index.js) and an ES module (dist/module/index.js).
The former is used by the serverless component, while the latter allows rollup to optimize size.

## build/

Contains logic needed for building manifests.

## route/

Contains routing logic.

Entry functions take manifests and request details and return Route objects.

## handle/

Contains logic for handling routes.

Entry functions take manifests and Events containing request/response.
They return unhandled routes or resolve the route to resp object given.
