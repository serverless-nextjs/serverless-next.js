const fse = require("fs-extra");

const readJsonFile = async filePath => {
  const str = await fse.readFile(filePath, "utf-8");
  return JSON.parse(str);
};

const readCloudFormationUpdateTemplate = fixturePath => {
  return readJsonFile(
    `${fixturePath}/.serverless/cloudformation-template-update-stack.json`
  );
};

module.exports = readCloudFormationUpdateTemplate;
