const path = require("path");

const getPageNameFromPath = pagePath => path.basename(pagePath, ".js");

const getHttpEventForPage = pageName => ({
  http: {
    path: pageName,
    method: "get"
  }
});

const getPageHandler = (pageName, pagePath) =>
  path.join(path.dirname(pagePath), `${pageName}.render`);

module.exports = pagePath => {
  const pageName = getPageNameFromPath(pagePath);
  const handler = getPageHandler(pageName, pagePath);
  const httpEvent = getHttpEventForPage(pageName);

  return {
    handler,
    events: [httpEvent]
  };
};
