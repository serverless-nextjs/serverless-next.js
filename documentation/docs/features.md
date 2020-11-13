---
id: features
title: Features
sidebar_label: Features
---

- [x] [Server side rendered pages at the Edge](https://github.com/zeit/next.js#fetching-data-and-component-lifecycle).
      Pages that need server side compute to render are hosted on Lambda@Edge. The component takes care of all the routing for you so there is no configuration needed. Because rendering happens at the CloudFront edge locations latency is very low!
- [x] [API Routes](https://nextjs.org/docs#api-routes).
      Similarly to the server side rendered pages, API requests are also served from the CloudFront edge locations using Lambda@Edge.
- [x] [Dynamic pages / route segments](https://github.com/zeit/next.js/#dynamic-routing).
- [x] [Automatic prerendering](https://github.com/zeit/next.js/#automatic-prerendering).
      Statically optimised pages compiled by next are served from CloudFront edge locations with low latency and cost.
- [x] [Client assets](https://github.com/zeit/next.js/#cdn-support-with-asset-prefix).
      Nextjs build assets `/_next/*` served from CloudFront.
- [x] [User static / public folders](https://github.com/zeit/next.js#static-file-serving-eg-images).
      Any of your assets in the static or public folders are uploaded to S3 and served from CloudFront automatically.
- [x] [Opt-in to static generation (SSG)](https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation) via `getStaticProps`.
- [x] [Opt-in to server-side rendering (SSR)](https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering) via `getServerSideProps`.
- [x] [Statically generate a set of routes from dynamic sources](https://nextjs.org/docs/basic-features/data-fetching#getstaticpaths-static-generation) via `getStaticPaths`.
- [ ] `getStaticPaths` using fallback page. See [RFC](https://github.com/serverless-nextjs/serverless-next.js/issues/355) for updates.
- [ ] Preview mode. See [RFC](https://github.com/serverless-nextjs/serverless-next.js/issues/355) for updates.

Refer the image below for Default Lambda@Edge and API Lambda@Edge

![lambdas](/img/lambdas.png)
