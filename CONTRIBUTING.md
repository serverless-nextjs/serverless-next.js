## Contributing

#### Getting started

1. First, [fork](https://help.github.com/en/articles/fork-a-repo) the repo to your own github account and clone it.
2. Install dependencies: `npm install`

#### Running the tests

### Unit tests

```bash
npm test
```

or in watch mode:

```bash
npm test -- --watch
```

### Integration

```bash
npm run integration
```

#### Testing the plugin on a serverless application

Configure the app's serverless.yml to use your fork of the plugin as documented [here](https://serverless.com/framework/docs/providers/aws/guide/plugins#service-local-plugin).

```yml
# serverless.yml
plugins:
  localPath: 'path/to/serverless-nextjs-plugin'
  modules:
	- index
```
