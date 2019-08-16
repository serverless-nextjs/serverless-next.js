// converts a nextjs dynamic route /[param]/ to express style /:param/
module.exports = dynamicRoute => {
  return dynamicRoute.replace(/\[(?<param>.*?)]/g, ":$<param>");
};
