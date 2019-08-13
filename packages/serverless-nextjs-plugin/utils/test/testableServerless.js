const Serverless = require("serverless");

module.exports = async (servicePath, command) => {
  const tmpCwd = process.cwd();

  process.chdir(servicePath);

  const serverless = new Serverless();

  serverless.invocationId = "test-run";

  process.argv[2] = command;

  await serverless.init();
  await serverless.run();

  process.chdir(tmpCwd);
};
