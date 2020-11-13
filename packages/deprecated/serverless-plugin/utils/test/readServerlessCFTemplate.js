const fse = require("fs-extra");

const readJsonFile = async (filePath) => {
  const str = await fse.readFile(filePath, "utf-8");
  return JSON.parse(str);
};

const readUpdateTemplate = (fixturePath) => {
  return readJsonFile(
    `${fixturePath}/.serverless/cloudformation-template-update-stack.json`
  );
};

const readCreateTemplate = (fixturePath) => {
  return readJsonFile(
    `${fixturePath}/.serverless/cloudformation-template-create-stack.json`
  );
};

module.exports = { readCreateTemplate, readUpdateTemplate };
