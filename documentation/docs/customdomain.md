---
id: customdomain
title: Custom domain name
sidebar_label: Custom domain name
---

In most cases you wouldn't want to use CloudFront's distribution domain to access your application. Instead, you can specify a custom domain name.

You can use any domain name but you must be using AWS Route53 for your DNS hosting. To migrate DNS records from an existing domain follow the instructions
[here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html). The requirements to use a custom domain name:

- Route53 must include a _hosted zone_ for your domain (e.g. `mydomain.com`) with a set of nameservers.
- You must update the nameservers listed with your domain name registrar (e.g. namecheap, godaddy, etc.) with those provided for your new _hosted zone_.

The serverless next.js component will automatically generate an SSL certificate and create a new record to point to your CloudFront distribution.

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: "example.com" # sub-domain defaults to www
```

You can also configure a `subdomain`:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: ["sub", "example.com"] # [ sub-domain, domain ]
```