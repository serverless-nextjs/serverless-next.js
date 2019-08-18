module.exports = manifest => {
  const {
    pages: {
      ssr: { dynamic, nonDynamic }
    }
  } = manifest;

  return path => {
    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    for (route in dynamic) {
      const { file, regex } = dynamic[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }
  };
};
