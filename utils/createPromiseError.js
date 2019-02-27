const createPromiseError = message => {
  return Promise.reject(new Error(`Serverless Nextjs: ${message}`));
};

module.exports = createPromiseError;
