const nextBuild = require("next/dist/build").default;
const pathToRegexp = require("path-to-regexp");
const fse = require("fs-extra");
const path = require("path");

const isDynamicRoute = route => {
  // Identify /[param]/ in route string
  return /\/\[[^\/]+?\](?=\/|$)/.test(route);
};

module.exports = async () => {
  await nextBuild(path.resolve("./"));

  const pagesManifest = await fse.readJSON(
    "./.next/serverless/pages/pages-manifest.json"
  );

  const newManifest = {
    pages: {
      ssr: {
        dynamic: {},
        nonDynamic: {}
      },
      html: {}
    },
    publicFiles: {}
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

  const publicFiles = await fse.readdir("./public");

  publicFiles.forEach(pf => {
    newManifest.publicFiles["/" + pf] = pf;
  });

  return newManifest;
};
