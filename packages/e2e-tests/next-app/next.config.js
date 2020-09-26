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
      }
    ];
  }
};
