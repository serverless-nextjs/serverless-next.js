declare module "@serverless/core" {
  export const utils: {
    sleep(milliseconds: number): void;
  };
  export class Component {
    load(modulePath: string, moduleName?: string): any;
    state: any;
    context: {
      credentials: {
        aws: any;
      };
      instance: {
        debugMode: boolean;
      };
      status(status: string): void;
      debug(message: string): void;
      log(message: string): void;
    };
    save(): void;
  }
}
