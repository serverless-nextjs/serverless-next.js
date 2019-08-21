module.exports = manifest => {
  const {
    pages: {
      ssr: { dynamic, nonDynamic },
      html
    }
  } = manifest;

  return path => {
    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    if (html[path]) {
      return html[path];
    }

    for (route in dynamic) {
      const { file, regex } = dynamic[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // path didn't match any route, return error page
    return "pages/_error.js";
  };
};
