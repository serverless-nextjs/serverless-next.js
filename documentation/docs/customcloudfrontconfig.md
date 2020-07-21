---
id: customcloudfrontconfig
title: Custom CloudFront configuration
sidebar_label: Custom CloudFront configuration
---

To specify your own CloudFront inputs, just add any [aws-cloudfront inputs](https://github.com/serverless-components/aws-cloudfront#3-configure) under `cloudfront`:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    cloudfront:
      # this is the default cache behaviour of the cloudfront distribution
      # the origin-request edge lambda associated to this cache behaviour does the pages server side rendering
      defaults:
        forward:
          headers:
            [
              CloudFront-Is-Desktop-Viewer,
              CloudFront-Is-Mobile-Viewer,
              CloudFront-Is-Tablet-Viewer,
            ]
      # this is the cache behaviour for next.js api pages
      api:
        ttl: 10
      # you can set other cache behaviours like "defaults" above that can handle server side rendering
      # but more specific for a subset of your next.js pages
      /blog/*:
        ttl: 1000
        forward:
          cookies: "all"
          queryString: false
      /about:
        ttl: 3000
      # you can add custom origins to the cloudfront distribution
      origins:
        - url: /static
          pathPatterns:
            /wp-content/*:
              ttl: 10
        - url: https://old-static.com
          pathPatterns:
            /old-static/*:
              ttl: 10
```

This is particularly useful for caching any of your next.js pages at CloudFront's edge locations. See [this](https://github.com/danielcondemarin/serverless-next.js/tree/master/packages/serverless-component/examples/app-with-custom-caching-config) for an example application with custom cache configuration.