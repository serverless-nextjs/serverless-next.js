#!/usr/bin/env node

// Cleanup Lambda code adapted from https://github.com/davidmenger/cleanup-lambda-versions/blob/master/src/cleanupVersions.js
import * as AWS from "aws-sdk";
import {
  ListFunctionsResponse,
  ListVersionsByFunctionResponse
} from "aws-sdk/clients/lambda";

function listLambdaFunctions(
  lambda: AWS.Lambda,
  nextMarker: string | undefined = undefined
): Promise<ListFunctionsResponse> {
  return new Promise((resolve, reject) => {
    const opts = {
      MaxItems: 999
    };

    if (nextMarker) {
      Object.assign(opts, { Marker: nextMarker });
    }

    lambda.listFunctions(opts, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

function listLambdaVersions(
  lambda: AWS.Lambda,
  fnName: string
): Promise<ListVersionsByFunctionResponse> {
  return new Promise((resolve, reject) => {
    lambda.listVersionsByFunction(
      {
        FunctionName: fnName,
        MaxItems: 50
      },
      (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    );
  });
}

function removeLambdaVersion(
  lambda: AWS.Lambda,
  fnName: string,
  version: string
): Promise<{}> {
  return new Promise((resolve, reject) => {
    lambda.deleteFunction(
      { FunctionName: fnName, Qualifier: version },
      (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    );
  });
}

async function cleanupVersions(
  region: string,
  removeIt: boolean = false,
  nextMarker: string | undefined = undefined
) {
  const lambda: AWS.Lambda = new AWS.Lambda({ region });
  const lambdas = await listLambdaFunctions(lambda, nextMarker);

  let i = 0;

  for (const fn of lambdas.Functions ?? []) {
    if (fn.FunctionName) {
      const versions = await listLambdaVersions(lambda, fn.FunctionName);

      for (const version of versions.Versions ?? []) {
        if (version.Version && version.Version !== fn.Version) {
          if (removeIt) {
            try {
              console.log(
                `Removing function: ${fn.FunctionName} - ${version.Version}`
              );
              await removeLambdaVersion(
                lambda,
                fn.FunctionName,
                version.Version
              );
              i++;
            } catch (e) {
              console.log(
                `Remove failed (${fn.FunctionName} - ${version.Version}): ${e.message}`
              );
            }
          } else {
            console.log(
              `Listing function only: ${fn.FunctionName} - ${version.Version}`
            );
            i++;
          }
        }
      }
    }
  }

  if (lambdas.NextMarker) {
    i += await cleanupVersions(region, removeIt, lambdas.NextMarker);
  }

  return i;
}

console.info("Cleaning up old Lambda versions");
cleanupVersions("us-east-1", true) // All Lambda@Edge is created in us-east-1 only
  .then((success) => {
    console.info(
      `Cleaning up old Lambda versions successful. Count: ${success}`
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
