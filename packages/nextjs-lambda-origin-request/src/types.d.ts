export type NextLambdaOriginRequestManifest = {
  cloudFrontOrigins: {
    staticOrigin: {
      domainName: string;
    };
  };
  pages: {
    ssr: {
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      nonDynamic: {
        [path: string]: string;
      };
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
    };
  };
  publicFiles: {
    [key: string]: string;
  };
};
