module.exports = {
  async redirects() {
    return [
      {
        source: "/permanent-redirect",
        destination: "/ssr-page",
        permanent: true
      },
      {
        source: "/temporary-redirect",
        destination: "/ssg-page",
        permanent: false
      },
      {
        source: "/custom-status-code-redirect",
        destination: "/ssr-page",
        statusCode: 302
      },
      {
        source: "/wildcard-redirect-1/:slug*",
        destination: "/ssg-page",
        permanent: true
      },
      {
        source: "/wildcard-redirect-2/:slug*",
        destination: "/wildcard-redirect-2-dest/:slug*",
        permanent: true
      },
      {
        source: "/regex-redirect-1/:slug(\\d{1,})",
        destination: "/ssg-page",
        permanent: true
      },
      {
        source: "/regex-redirect-2/:slug(\\d{1,})",
        destination: "/regex-redirect-2-dest/:slug",
        permanent: true
      },
      {
        source: "/api/deprecated-basic-api",
        destination: "/api/basic-api",
        permanent: true
      },
      {
        source: "/external-redirect-1",
        destination: "https://api.github.com",
        permanent: true
      },
      {
        source: "/external-redirect-2/:id",
        destination: "https://api.github.com/:id",
        permanent: true
      },
      {
        source: "/external-redirect-3/:id",
        destination: "https://api.github.com/:id/",
        permanent: true
      },
      {
        source: "/query-string-destination-redirect",
        destination: "/ssg-page?a=1234&b=1?",
        permanent: true
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/rewrite",
        destination: "/ssr-page"
      },
      {
        source: "/path-rewrite/:slug",
        destination: "/ssr-page"
      },
      {
        source: "/wildcard-rewrite/:slug*",
        destination: "/ssr-page"
      },
      {
        source: "/regex-rewrite-1/:slug(\\d{1,})",
        destination: "/ssr-page"
      },
      {
        source: "/regex-rewrite-2/:slug(\\d{1,})",
        destination: "/regex-rewrite-2-dest/:slug"
      },
      {
        source: "/api/rewrite-basic-api",
        destination: "/api/basic-api"
      }
    ];
  }
};
