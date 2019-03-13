const { spawn } = require("child_process");
const serverlessExec = require("./getServerlessExec");

const bufferToStr = buffer => Buffer.from(buffer).toString("utf8");

module.exports = () => {
  return new Promise((resolve, reject) => {
    const serverlessOffline = spawn(serverlessExec, ["offline"]);

    serverlessOffline.stdout.on("data", data => {
      const stdoutStr = bufferToStr(data);

      console.log(stdoutStr);

      if (stdoutStr.includes("Offline listening on")) {
        resolve(serverlessOffline);
      }
    });

    serverlessOffline.stderr.on("err", data => {
      const err = bufferToStr(data);

      console.log(err);

      reject(new Error(`serverless-offline failed, ${err}`));
    });
  });
};
