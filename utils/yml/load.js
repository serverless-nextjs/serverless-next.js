const path = require("path");
const fse = require("fs-extra");
const yaml = require("js-yaml");
const cfSchema = require("./cfSchema");

const load = async ymlRelativePath => {
  const fullPath = path.resolve(__dirname, ymlRelativePath);

  const ymlStr = await fse.readFile(fullPath, "utf-8");

  return yaml.safeLoad(ymlStr, {
    fullPath,
    schema: cfSchema
  });
};

module.exports = load;
