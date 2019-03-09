const execSync = require("child_process").execSync;
const serverlessExec = require("./getServerlessExec");

module.exports = () => {
  execSync(`${serverlessExec} package`, { stdio: "inherit" });
};
