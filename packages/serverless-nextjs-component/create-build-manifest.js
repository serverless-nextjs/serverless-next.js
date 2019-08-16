const pathToRegexp = require("path-to-regexp");

const isDynamicRoute = route => {
  // Identify /[param]/ in route string
  return /\/\[[^\/]+?\](?=\/|$)/.test(route);
};

module.exports = pagesManifest => {
  const newManifest = {
    pages: {
      ssr: {
        dynamic: {},
        nonDynamic: {}
      },
      html: {}
    }
  };
  const ssr = newManifest.pages.ssr;
  const allRoutes = Object.keys(pagesManifest);

  allRoutes.forEach(r => {
    if (pagesManifest[r].endsWith(".html")) {
      newManifest.pages.html[r] = pagesManifest[r];
    } else if (isDynamicRoute(r)) {
      const expressRoute = r.replace(/\[(?<param>.*?)]/g, ":$<param>"); // replace [foo] with :foo
      ssr.dynamic[expressRoute] = {
        file: pagesManifest[r],
        regex: pathToRegexp(expressRoute)
          .toString()
          .replace(/\/(.*)\/\i/, "$1")
      };
    } else {
      ssr.nonDynamic[r] = pagesManifest[r];
    }
  });

  return newManifest;
};
