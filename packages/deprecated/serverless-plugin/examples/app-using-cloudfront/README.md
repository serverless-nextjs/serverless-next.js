## app-using-cloudfront

### Running the example

```shell
git clone https://github.com/serverless-nextjs/serverless-next.js
cd serverless-plugin/examples/app-using-cloudfront
```

#### Install dependencies

```shell
npm install
```

#### Deploy

`serverless deploy`

The first deployment will take a while, typically 10-15 minutes for CloudFront to propagate the changes. However, deployments afterwards will be quick since the cloudfront distribution stays the same!

After deployment completes, go to the CloudFront distribution URL provisioned and enjoy!
