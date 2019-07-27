const Serverless = require("serverless");

module.exports = async (servicePath, command) => {
  console.log("TCL: servicePath", servicePath);
  const tmpCwd = process.cwd();

  process.chdir(servicePath);

  try {
    const serverless = new Serverless();

    serverless.invocationId = "test-run";

    process.argv[2] = command;

    jest.useFakeTimers();
    setTimeout.mockImplementation(cb => cb());

    await serverless.init();
    await serverless.run();

    jest.useRealTimers();
  } catch (err) {
    console.log("TCL: err", err);
    throw err;
  }

  process.chdir(tmpCwd);
};
