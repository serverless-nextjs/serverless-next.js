## app-with-custom-lambda-handler

### Running the example

```shell
git clone https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/deprecated/serverless-plugin
cd serverless-nextjs-plugin/examples/app-with-custom-lambda-handler
```

#### Install dependencies

```shell
npm install
```

_next.config.js_

```js
module.exports = {
  ...
  target: "serverless"
};
```

#### Deploy

`serverless deploy`

After deployment is finished, visit the `/home` page, go to CloudWatch and check the LogGroup for the HomePage lambda to see the extra logging added by `my-lambda-handler.js`
