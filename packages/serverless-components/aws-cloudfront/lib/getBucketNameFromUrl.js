module.exports = (hostname) => {
  const domains = hostname.split(".");
  return domains.slice(0, domains.indexOf("s3")).join(".");
};
