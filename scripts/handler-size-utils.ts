import * as path from "path";
import * as fs from "fs";

type HandlerConfiguration = {
  path: string;
  handlers: Record<string, Record<string, string>>;
};

export const PLATFORM_CONFIGS: Record<string, HandlerConfiguration> = {
  Lambda: {
    path: "packages/libs/lambda",
    handlers: {
      "Default Lambda": {
        Standard: "dist/bundles/default-handler/standard",
        Minified: "dist/bundles/default-handler/minified"
      },
      "Image Lambda": {
        Standard: "dist/bundles/image-handler/standard",
        Minified: "dist/bundles/image-handler/minified"
      }
    }
  },
  "Lambda@Edge": {
    path: "packages/libs/lambda-at-edge",
    handlers: {
      "Default Lambda": {
        Standard: "dist/default-handler/standard",
        Minified: "dist/default-handler/minified"
      },
      "Default Lambda V2": {
        Standard: "dist/default-handler-v2/standard",
        Minified: "dist/default-handler-v2/minified"
      },
      "API Lambda": {
        Standard: "dist/api-handler/standard",
        Minified: "dist/api-handler/minified"
      },
      "Image Lambda": {
        Standard: "dist/image-handler/standard",
        Minified: "dist/image-handler/minified"
      },
      "Regeneration Lambda": {
        Standard: "dist/regeneration-handler/standard",
        Minified: "dist/regeneration-handler/minified"
      },
      "Regeneration Lambda V2": {
        Standard: "dist/regeneration-handler-v2/standard",
        Minified: "dist/regeneration-handler-v2/minified"
      }
    }
  }
};

export const getDirectorySizeInKilobytes = (
  directoryPath: string
): number | undefined => {
  let size = 0;

  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      size += fs.statSync(path.join(directoryPath, file)).size;
    });
    return Math.round(size / 1024);
  } else {
    return undefined;
  }
};

export const calculateHandlerSizes = (): Record<string, any> => {
  const sizes: Record<string, any> = {};

  for (const [platform, platformConfig] of Object.entries(PLATFORM_CONFIGS)) {
    sizes[platform] = {};
    const packagePath = platformConfig.path;
    for (const [handler, handlerConfig] of Object.entries(
      platformConfig.handlers
    )) {
      sizes[platform][handler] = {};
      for (const [handlerType, handlerPath] of Object.entries(handlerConfig)) {
        const relativePath = path.join(packagePath, handlerPath);
        sizes[platform][handler][handlerType] =
          getDirectorySizeInKilobytes(relativePath);
      }
    }
  }

  return sizes;
};
