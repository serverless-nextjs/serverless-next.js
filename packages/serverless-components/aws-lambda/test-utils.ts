import * as fse from "fs-extra";
import * as path from "path";
import * as os from "os";
import LambdaComponent from "./src/component";

const createTmpDir = () => {
  return fse.mkdtemp(path.join(os.tmpdir(), "test-"));
};

const createComponent = async () => {
  // create tmp folder to avoid state collisions between tests
  const tmpFolder = await createTmpDir();

  // @ts-ignore
  const component = new LambdaComponent("TestLambda", {
    stateRoot: tmpFolder
  });

  await component.init();

  return component;
};

export { createComponent, createTmpDir };
