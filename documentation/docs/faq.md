---
id: faq
title: Frequently Asked Questions
sidebar_label: FAQs
---

### My component doesn't deploy

Make sure your `serverless.yml` uses the `serverless-components` format. [serverless components](https://serverless.com/blog/what-are-serverless-components-how-use/) differ from the original serverless framework, even though they are both accessible via the same CLI.

✅ **Do**

```yml
# serverless.yml
myNextApp:
  component: serverless-next.js

myTable:
  component: serverless/aws-dynamodb
  inputs:
    name: Customers
# other components
```

❌ **Don't**

```yml
# serverless.yml
provider:
  name: aws
  runtime: nodejs10.x
  region: eu-west-1

myNextApp:
  component: serverless-next.js

Resources: ...
```

Note how the correct yaml doesn't declare a `provider`, `Resources`, etc.

For deploying, don't run `serverless deploy`. Simply run `serverless` and that deploys your components declared in the `serverless.yml` file.

For more information about serverless components go [here](https://serverless.com/blog/what-are-serverless-components-how-use/).

### Should I use the [serverless-plugin](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/deprecated/serverless-plugin) or this component?

Users are encouraged to use this component instead of the `serverless-plugin`. This component was built and designed using lessons learned from the serverless plugin.

### How do I interact with other AWS Services within my app?

See `examples/dynamodb-crud` for an example Todo application that interacts with DynamoDB. You can find a full list of examples [here](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-component/examples)

### [CI/CD] A new CloudFront distribution is created on every CI build. I wasn't expecting that

You need to commit your application state in source control. That is the files under the `.serverless` directory. Alternatively you could use S3 to store the `.serverless` files, see an example [here](https://gist.github.com/hadynz/b4e190e0ce10e5811cb462920a9c678f)

The serverless team is currently working on remote state storage so this won't be necessary in the future.

### My lambda is deployed to `us-east-1`. How can I deploy it to another region?

Serverless next.js is _regionless_. By design, `serverless-next.js` applications will be deployed across the globe to every CloudFront edge location. The lambda might look like is only deployed to `us-east-1` but behind the scenes, it is replicated to every other region.

### I require passing additional information into my build

See the sample below for an advanced `build` setup that includes passing additional arguments and environment variables to the build.

```yml
# serverless.yml
myDatabase:
  component: MY_DATABASE_COMPNENT
myNextApp:
  component: serverless-next.js
  build:
    args: ["build", "custom/path/to/pages"]
    env:
      DATABASE_URL: ${myDatabase.databaseUrl}
```

### I was expecting for automatic subdomain redirection when using the domainType: www/apex input

The redirection is not currently implemented, but there is a manual workaround outlined [here](https://simonecarletti.com/blog/2016/08/redirect-domain-https-amazon-cloudfront/#configuring-the-amazon-s3-static-site-with-redirect).
In summary, you will have to create a new S3 bucket and set it up with static website hosting to redirect requests to your supported subdomain type (ex. "www.example.com" or "example.com"). To be able to support HTTPS redirects, you'll need to set up a CloudFront distribution with the S3 redirect bucket as the origin. Finally, you'll need to create an "A" record in Route 53 with your newly created CloudFront distribution as the alias target.
