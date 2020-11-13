const createError = (message) => {
  return new Error(`Serverless Nextjs: ${message}`);
};

module.exports = createError;
