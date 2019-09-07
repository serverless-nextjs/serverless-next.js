const fse = require("fs-extra");
const path = require("path");
const { BUILD_DIR } = require("../constants");

const createCloudFrontEvent = ({ uri, host, origin }) => ({
  Records: [
    {
      cf: {
        request: {
          uri,
          headers: {
            host: [
              {
                key: "host",
                value: host
              }
            ]
          },
          origin
        }
      }
    }
  ]
});

const cleanupFixtureDirectory = fixtureDir => () => {
  return fse.remove(path.join(fixtureDir, BUILD_DIR));
};

module.exports = {
  createCloudFrontEvent,
  cleanupFixtureDirectory
};
