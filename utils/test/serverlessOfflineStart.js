const { spawn } = require("child_process");
const serverlessExec = require("./getServerlessExec");

const bufferToStr = buffer => Buffer.from(buffer).toString("utf8");

module.exports = () => {
  return new Promise((resolve, reject) => {
    const serverlessOffline = spawn(serverlessExec, ["offline"]);

    serverlessOffline.stdout.on("data", data => {
      const stdoutStr = bufferToStr(data);

      if (stdoutStr.includes("Offline listening on")) {
        resolve(serverlessOffline);
      }
    });

    serverlessOffline.stderr.on("data", data => {
      const err = bufferToStr(data);

      reject(new Error(`serverless-offline failed, ${err}`));
    });

    serverlessOffline.on("error", err => reject(err));
  });
};
