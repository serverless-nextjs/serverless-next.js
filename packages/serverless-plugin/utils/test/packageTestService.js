const execSync = require("child_process").execSync;
const serverlessExec = require("./getServerlessExec");

module.exports = () => {
  const execOptions = { stdio: "inherit" };
  execOptions.env = process.env;

  execSync(`${serverlessExec} package`, execOptions);
};
