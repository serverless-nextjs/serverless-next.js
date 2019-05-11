const fse = require("fs-extra");
const yaml = require("js-yaml");
const cfSchema = require("./cfSchema");

const load = async ymlFullPath => {
  const ymlStr = await fse.readFile(ymlFullPath, "utf-8");

  return yaml.safeLoad(ymlStr, {
    ymlFullPath,
    schema: cfSchema
  });
};

module.exports = load;
