const Serverless = require("serverless");

module.exports = async (servicePath, command) => {
  console.log("TCL: servicePath", servicePath);
  const tmpCwd = process.cwd();

  process.chdir(servicePath);

  try {
    const serverless = new Serverless();

    serverless.invocationId = "test-run";

    process.argv[2] = command;

    // setTimeout.mockImplementation(cb => {
    //   cb();
    // });

    await serverless.init();
    const runPromise = serverless.run();

    console.log("HERE?");
    jest.runAllTimers();

    await runPromise;
  } catch (err) {
    console.log("TCL: err", err);
    throw err;
  }

  process.chdir(tmpCwd);
};
