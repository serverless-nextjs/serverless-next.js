const { spawn } = require("child_process");
const serverlessExec = require("./getServerlessExec");

const bufferToStr = buffer => Buffer.from(buffer).toString("utf8");

module.exports = () => {
  const serverlessOffline = spawn(serverlessExec, ["offline"]);

  return new Promise((resolve, reject) => {
    serverlessOffline.stdout.on("data", data => {
      const stdoutStr = bufferToStr(data);

      process.stdout.write(stdoutStr);

      if (stdoutStr.includes("Offline listening on")) {
        resolve(serverlessOffline);
      }
    });

    serverlessOffline.stderr.on("data", data => {
      const err = bufferToStr(data);
      process.stdout.write(err);
    });

    serverlessOffline.on("error", err => reject(err));
  });
};
