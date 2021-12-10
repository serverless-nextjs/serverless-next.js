declare module "@serverless/core" {
  import { Credentials } from "@sls-next/s3-static-assets/src/lib/s3";

  export class Component {
    load(modulePath: string, moduleName?: string): any;
    state: any;
    context: {
      credentials: {
        aws: Credentials;
      };
      instance: {
        debugMode: boolean;
      };
      status(status: string): void;
      debug(message: string): void;
    };
    save(): void;
  }
}
