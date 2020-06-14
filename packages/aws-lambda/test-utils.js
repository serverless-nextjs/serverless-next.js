const fse = require("fs-extra");
const path = require("path");
const os = require("os");
const LambdaComponent = require("./serverless");

const createTmpDir = () => {
  return fse.mkdtemp(path.join(os.tmpdir(), "test-"));
};

const createComponent = async () => {
  // create tmp folder to avoid state collisions between tests
  const tmpFolder = await createTmpDir();

  const component = new LambdaComponent("TestLambda", {
    stateRoot: tmpFolder
  });

  await component.init();

  return component;
};

module.exports = { createComponent, createTmpDir };
