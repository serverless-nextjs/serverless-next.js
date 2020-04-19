### AWS Lambda@Edge handlers you can use to deploy your next applications to CloudFront

#### Usage

First make sure you have a valid manifest.json. The following TS type is the contract for the manifest:

```
export type OriginRequestDefaultHandlerManifest = {
  cloudFrontOrigins: {
    staticOrigin: {
      domainName: string;
    };
  };
  pages: {
    ssr: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      nonDynamic: {
        [path: string]: string;
      };
      dynamic: DynamicPageKeyValue;
    };
  };
  publicFiles: {
    [key: string]: string;
  };
};

A separate package in the monorepo will be created to produce these manifests.

Then simply upload the handler alongside the manifest and pages to the Lambda function:

```

> artifact.zip
>
> > handler.js # this would be @sls-next/lambda-origin-request/dist/defaultHandler.bundle.js
> > pages # pages directory from nextjs build
> > manifest.json # build manifest as per the above

```

```
