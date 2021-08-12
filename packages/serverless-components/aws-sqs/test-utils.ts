import * as fse from "fs-extra";
import * as path from "path";
import * as os from "os";
import AwsSqsQueue from "./serverless"; // FIXME: loses coverage but for some reason jest doesn't work from root if importing from component.ts

const createTmpDir = (): Promise<string> => {
  return fse.mkdtemp(path.join(os.tmpdir(), "test-aws-sqs-"));
};

const createComponent = async (url?: string): Promise<AwsSqsQueue> => {
  // create tmp folder to avoid state collisions between tests
  const tmpStateFolder = (initialState?: { url: string }) => {
    const dir = fse.mkdtempSync(path.join(os.tmpdir(), "test-aws-sqs-"));
    if (initialState) {
      fse.writeJSONSync(path.join(dir, "TestSqsQueue.json"), initialState);
    }
    return dir;
  };

  // @ts-ignore
  const component = new AwsSqsQueue("TestSqsQueue", {
    stateRoot: tmpStateFolder(url ? { url: url } : undefined)
  });

  await component.init();

  return component;
};

export { createComponent, createTmpDir };
