# eslint-config-mapbox

[![Build Status](https://travis-ci.org/mapbox/eslint-config-mapbox.svg?branch=master)](https://travis-ci.org/mapbox/eslint-config-mapbox)

[Shared ESLint config](https://eslint.org/docs/developer-guide/shareable-configs) for Mapbox engineering teams.

## Quick start with Node.js

1. Install the following dev-dependencies:

    ```
    npm install --save-dev \
      @mapbox/eslint-config-mapbox \
      eslint \
      eslint-plugin-node
    ```

2. Extend the `@mapbox/eslint-config-mapbox` config in your `.eslintrc` (or `eslintConfig` key in your `package.json`):

    ```json
    "eslintConfig": {
      "extends": "@mapbox/eslint-config-mapbox"
    }
    ```

3. Specify the version of Node.js your project uses by setting `.engines.node` in your `package.json`.

    ```json
    {
      "engines": {
        "node": ">=6"
      }
    }
    ```

4. Run `eslint` on your project as part of your `test` and `lint` scripts:

    ```json
    {
      "scripts": {
        "test": "tape test/*.test.js && eslint *.js test/*.js",
        "lint": "eslint *.js test/*.js"
      }
    }
    ```

## Usage

The "Quick start" above exemplifies usage of this package with standard Node.js code.

Depending on the ECMAScript version of your code, whether you are using non-standard syntax like Flow and React's JSX, or other considerations, you may want to extend a variety of configurations provided by this package. `eslint-config-mapbox` exposes several configurations targeting specific ESLint plugins, each named after the plugin it targets.

To use each plugin-specific configuration, you'll need to do the following:

- Install as dev-dependencies `@mapbox/eslint-config-mapbox`, `eslint`, and any plugins that are used by the configuration(s) you are extending, such as `eslint-plugin-node` or `eslint-plugin-react`.
- Add the configuration(s) you are using to the `"extends"` array in your project's ESLint configuration, like this:

    ```json
    {
      "extends": [
        "@mapbox/eslint-config-mapbox/react",
        "@mapbox/eslint-config-mapbox/import",
        "@mapbox/eslint-config-mapbox/promise"
      ]
    }
    ```

### Plugin-specific configurations

- [`@mapbox/eslint-config-mapbox`**`/node`**](./node.js)
  - Depends on [eslint-plugin-node](https://github.com/mysticatea/eslint-plugin-node).
  - For Node.js and CommonJS.
  - Specify the version of Node.js your project uses by either setting `.engines.node` in your `package.json`, or by extending an LTS-version-specific ESLint configuration: **`node4`, `node6`, `node8`**.
- [`@mapbox/eslint-config-mapbox`**`/react`**](./react.js)
  - Depends on [eslint-plugin-react](https://github.com/yannickcr/eslint-plugin-react).
  - For React and JSX.
- [`@mapbox/eslint-config-mapbox`**`/import`**](./import.js)
  - Depends on [eslint-plugin-import](https://github.com/benmosher/eslint-plugin-import).
  - For ES2015 modules (`import` and `export`).
- [`@mapbox/eslint-config-mapbox`**`/promise`**](./promise.js)
  - Depends on [eslint-plugin-promise](https://github.com/xjamundx/eslint-plugin-promise).
  - For `Promise`s.
- [`@mapbox/eslint-config-mapbox`**`/xss`**](./xss.js)
  - Depends on [eslint-plugin-xss](https://github.com/Rantanen/eslint-plugin-xss).
  - For avoiding potential XSS issues in front end JavaScript.
  - Does not perform any JavaScript style linting if used on its own.

### With Prettier

If you are using [Prettier](https://prettier.io/) to format your JS, install [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) and add it at the end of your `"extends"` array. It will turn off all ESLint rules related to the code-style preferences that Prettier already addresses.