declare module "@serverless/core" {
  export class Component {
    credentials: {
      aws: { accessKeyId: string; secretAccessKey: string };
    };
  }
}
