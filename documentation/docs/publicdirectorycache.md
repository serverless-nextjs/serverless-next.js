---
id: publicdirectorycache
title: Public directory caching
sidebar_label: Public directory caching
---

By default, common image formats(`gif|jpe?g|jp2|tiff|png|webp|bmp|svg|ico`) under `/public` or `/static` folders
have a one-year `Cache-Control` policy applied(`public, max-age=31536000, must-revalidate`).
You may customize either the `Cache-Control` header `value` and the regex of which files to `test`, with `publicDirectoryCache`:

```yaml
myNextApplication:
  component: serverless-next.js
  inputs:
    publicDirectoryCache:
      value: public, max-age=604800
      test: /\.(gif|jpe?g|png|txt|xml)$/i
```

`value` must be a valid `Cache-Control` policy and `test` must be a valid `regex` of the types of files you wish to test.
If you don't want browsers to cache assets from the public directory, you can disable this:

```yaml
myNextApplication:
  component: serverless-next.js
  inputs:
    publicDirectoryCache: false
```
