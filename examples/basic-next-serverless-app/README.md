## basic-next-serverless-app

### Running the example:

`git clone https://github.com/danielcondemarin/serverless-nextjs-plugin`

`cd examples/basic-next-serverless-app`

#### Install dependencies:

`npm install`

Configure nextjs to use a CDN to host the static assets in the bucket:

Replace _BUCKET_NAME_ with your own name. Don't manually create the bucket, the plugin will do that for you.

_next.config.js_

```
module.exports = {
  ...
  assetPrefix: "https://s3.amazonaws.com/BUCKET_NAME"
};
```

#### It's good to deploy now!

`serverless deploy`

After deployment is finished, go to the API GW provisioned by serverless and you should be able to hit `dev/home` and `dev/about` pages.
