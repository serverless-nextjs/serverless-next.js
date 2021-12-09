// Cleanup Lambda code adapted from https://github.com/davidmenger/cleanup-lambda-versions/blob/master/src/cleanupVersions.js
import AWS from "aws-sdk";
import {
  FunctionConfiguration,
  ListVersionsByFunctionResponse
} from "aws-sdk/clients/lambda";

async function listLambdaVersions(
  lambda: AWS.Lambda,
  fnName: string
): Promise<ListVersionsByFunctionResponse> {
  return await lambda
    .listVersionsByFunction({
      FunctionName: fnName,
      MaxItems: 50
    })
    .promise();
}

async function removeLambdaVersion(
  lambda: AWS.Lambda,
  fnName: string,
  version: string
): Promise<unknown> {
  return await lambda
    .deleteFunction({ FunctionName: fnName, Qualifier: version })
    .promise();
}

async function getLambdaFunction(
  lambda: AWS.Lambda,
  fnName: string
): Promise<FunctionConfiguration> {
  return await lambda
    .getFunctionConfiguration({ FunctionName: fnName })
    .promise();
}

/**
 * Clean up old lambda versions, up to 50 at a time.
 * Currently it just removes the version that's not the current version,
 * but if needed we could add support for preserving the latest X versions.
 * @param context
 * @param fnName
 * @param region
 */
export async function removeLambdaVersions(
  context: any,
  fnName: string,
  region: string
) {
  const lambda: AWS.Lambda = new AWS.Lambda({ region });
  const fnConfig = await getLambdaFunction(lambda, fnName);

  const versions = await listLambdaVersions(lambda, fnConfig.FunctionName);

  for (const version of versions.Versions ?? []) {
    if (version.Version && version.Version !== fnConfig.Version) {
      try {
        context.debug(
          `Removing function: ${fnConfig.FunctionName} - ${version.Version}`
        );
        await removeLambdaVersion(
          lambda,
          fnConfig.FunctionName,
          version.Version
        );
      } catch (e) {
        context.debug(
          `Remove failed (${fnConfig.FunctionName} - ${version.Version}): ${e.message}`
        );
      }
    }
  }
}
