## Description

Example nextjs serverless app using a dynamodb database replicated across `eu-west-2` and `us-west-2`.

## Getting started

Install serverless-next.js component dependency

```bash
cd ../../
npm install
```

Install example project deps:

`npm install`

Rename `.env.sample` to `.env` and set your aws credentials.

## Local development

#### Provision the DynamoDB Todos Table

Make sure you have a [running local dynamodb server](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html).

Then simply run:

`npm run dev:infra`

#### Start the next app

`npm run dev`
// available at http://localhost:3000

## Production

#### Provision the DynamoDB Global Todos Table

`npm run infra`

#### Deploying

To deploy your application to the cloud:

`npx serverless`

#### Tearing down the application resources

`npx serverless remove`

## A few notes

- Server side the DynamoDB table is queried directly for SSR of the page
- On client side `fetch` is used to query the /api that talks to DynamoDB. Client side routing prevents having to reload every resource on the page like js, css, etc.
- Top level resources like /favicon.ico can be placed on the `public/` folder
- Images or any other user assets can be placed in the `static/` folder and are accessible via `/static/*`
