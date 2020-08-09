const http = require("http");

module.exports = (url) => {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const { statusCode } = res;

        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode,
            response: rawData
          });
        });
      })
      .on("err", (e) => reject(e));
  });
};
