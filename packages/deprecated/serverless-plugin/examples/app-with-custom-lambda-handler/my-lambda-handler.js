const compat = require("@sls-next/next-aws-lambda");

module.exports = (page) => {
  const handler = (event, context, callback) => {
    // let's add some logging
    console.log("URL: ", event.path);

    // render page
    compat(page)(event, context, callback);

    console.log("This is cool (☞ﾟ∀ﾟ)☞");
  };
  return handler;
};
