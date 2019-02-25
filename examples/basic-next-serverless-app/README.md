## basic-next-serverless-app example

### Running the example:

`git clone https://github.com/danielcondemarin/serverless-nextjs-plugin`

`cd examples/basic-next-serverless-app`

#### Install dependencies:

`npm install`

#### Use your own bucket name for hosting the static assets:

Replace `staticAssetsBucket` bucket name with your own:

_serverless.yml_

```
custom:
  serverless-nextjs:
    ...
    staticAssetsBucket: BUCKET_NAME
```

Configure nextjs to use a CDN to host the static assets in the bucket:

_next.config.js_

```
module.exports = {
  ...
  assetPrefix: "https://s3.amazonaws.com/BUCKET_NAME"
};
```

#### It's good to deploy now, just build the next app and deploy!

`npm run build && sls deploy`

After deployment is finished, go to the API GW provisioned by serverless and you should be able to hit `dev/home` and `dev/about` pages.
