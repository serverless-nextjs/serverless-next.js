export type BuildOptions = {
  authentication?: {
    username: string;
    password: string;
  };
  buildId: string;
  domainRedirects: {
    [key: string]: string;
  };
  separateApiLambda?: boolean;
  disableOriginResponseHandler?: boolean;
  useV2Handler?: boolean;
};

export type NextConfig = {
  trailingSlash?: boolean;
};

export type DynamicPageKeyValue = {
  [key: string]: {
    file: string;
    regex: string;
  };
};

// Image optimization
export type ImageConfig = {
  deviceSizes: number[];
  imageSizes: number[];
  loader: "default" | "imgix" | "cloudinary" | "akamai";
  path: string;
  formats: string[];
  domains?: string[];
};

export type ImagesManifest = {
  version: number;
  images: ImageConfig;
};
