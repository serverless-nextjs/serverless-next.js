### Core library for running serverless Next.js

Decouples the core routing logic from a particular provider.
The types defined are meant to be abstract to use with any provider.

Code coverage relies on jest configuration:

    "moduleNameMapper": {
      "@sls-next/core": "<rootDir>/packages/libs/core/src/index.ts"
    },

Builds twice, both a commonjs module (dist/index.js) and an ES module (dist/module/index.js).
The former is used by the serverless component, while the latter allows rollup to optimize size.
