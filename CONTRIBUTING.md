## Contributing

### Getting started

1. First, [fork](https://help.github.com/en/articles/fork-a-repo) the repo to your own github account and clone it.
2. Install dependencies: `npm install && npm run packages-install`

### Running the tests

#### Unit tests

I recommend testing the specific package in the monorepo that you are working with. For example:

```bash
npm test -- lambda-at-edge/
```

In watch mode:

```bash
npm test -- --watch lambda-at-edge/
```

### Deploying to AWS and testing your changes

First, create your own test serverless component app and in the `serverless.yml` point the `component` field to your fork:

```yml
# serverless.yml
nextApp:
  component: "/path/to/your/fork/serverless-next.js/packages/serverless-component"
  inputs: ...
```

Then from the app simply run `serverless` or `npx serverless` if you don't have the serverless cli installed.

Note: If you are working with a Typescript package make sure you build it (`npm run build`) before deploying ;)
