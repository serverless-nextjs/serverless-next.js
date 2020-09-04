module.exports = (hostname) => {
  const components = hostname.split(".");
  return components.slice(0, components.indexOf("s3")).join(".");
};
