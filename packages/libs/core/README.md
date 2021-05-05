### Core library for running serverless Next.js

Decouples the core routing logic from a particular provider.
The types defined are meant to be abstract to use with any provider.

Code coverage relies on jest configuration:

    "moduleNameMapper": {
      "@sls-next/core": "<rootDir>/packages/libs/core/src/index.ts"
    },
