---
id: installation
title: Installation
sidebar_label: Installation
---

See the steps below to get started and install the Serverless Nextjs component in your NextJS project and then deploy

1. Create a NextJS project: `npx create-next-app my-nextjs-app`
2. (Optional) Once it is created, you can run the app locally: `npm run dev`
3. (Optional) Open [http://localhost:3000](http://localhost:3000) with your browser to see the application
4. Create a `serverless.yml` file at the root of your project and add your NextJS application as shown below:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@1.15.2-alpha.1" #specify latest stable version
```

5. It is recommended you pin the latest stable version of serverless-next.js component. Check out the versions [here](https://github.com/serverless-nextjs/serverless-next.js/releases)
6. Create a `.env` file at the root of your project to spcify AWS credentials:

```bash
#.env

AWS_ACCESS_KEY_ID=accesskey
AWS_SECRET_ACCESS_KEY=accesskeysecret
```

7. And simply deploy by running the command below from your project root:

```bash
$ serverless
```

If you get an error during the deployment process, checkout the [FAQ](./faq.md).
