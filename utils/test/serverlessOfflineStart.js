const spawnSync = require("child_process").spawnSync;
const serverlessExec = require("./getServerlessExec");

module.exports = () => {
  const options = { stdio: "inherit" };
  return spawnSync(`${serverlessExec} offline`, options);
};
