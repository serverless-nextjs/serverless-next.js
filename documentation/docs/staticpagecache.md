---
id: staticpagecache
title: Static pages caching
sidebar_label: Static pages caching
---

Statically rendered pages (i.e. HTML pages that are uploaded to S3) have the following Cache-Control set:

```
cache-control: public, max-age=0, s-maxage=2678400, must-revalidate
```

`s-maxage` allows Cloudfront to cache the pages at the edge locations for 31 days.
`max-age=0` in combination with `must-revalidate` ensure browsers never cache the static pages. This allows Cloudfront to be in full control of caching TTLs. On every deployment an invalidation`/*` is created to ensure users get fresh content.
