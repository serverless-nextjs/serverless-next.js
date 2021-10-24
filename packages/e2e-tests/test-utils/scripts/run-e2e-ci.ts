#!/usr/bin/env node

// Script to run e2e tests in a CI environment

// FIXME: not sure why TS types cannot be found
// @ts-ignore
import fetch from "node-fetch";
// @ts-ignore
import { v4 as uuidv4 } from "uuid";
// @ts-ignore
import * as AWS from "aws-sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Next.js build ID follows a certain pattern
const buildIdRegex = /"buildId":"([a-zA-Z0-9_-]+)"/;

// AWS clients
const cloudfront = new AWS.CloudFront();

// Timeout from environment variable. By default it's 10 minutes.
const waitTimeout = parseInt(process.env["WAIT_TIMEOUT"] ?? "600");

// Constants
const deploymentBucketName = "serverless-next-js-e2e-test"; // For saving .serverless state
const appName = process.env["APP_NAME"] || ""; // app name to store in deployment bucket. Choose a unique name per test app.

const ssgPagePath = process.env["SSG_PAGE_PATH"];
const ssrPagePath = process.env["SSR_PAGE_PATH"];
const isrPagePath = process.env["ISR_PAGE_PATH"];
const dynamicIsrPagePath = process.env["DYNAMIC_ISR_PAGE_PATH"];

if (appName === "") {
  throw new Error("Please set the APP_NAME environment variable.");
}

// To ensure cleanup doesn't happen more than once
let alreadyCleaned = false;

/**
 * Check that the given URL matched the expected build ID.
 * @param url
 * @param buildId
 * @param waitDuration
 * @param pollInterval
 */
async function checkWebAppBuildId(
  url: string,
  buildId: string,
  waitDuration: number,
  pollInterval: number
): Promise<boolean> {
  const startDate = new Date();
  const startTime = startDate.getTime();
  const waitDurationMillis = waitDuration * 1000;

  while (new Date().getTime() - startTime < waitDurationMillis) {
    // Guarantee that CloudFront cache is missed by appending uuid query parameter.
    const uuid: string = uuidv4().replace("-", "");
    const suffixedUrl = `${url}${url.endsWith("/") ? "" : "/"}?uuid=${uuid}`;

    try {
      const response = await fetch(suffixedUrl);

      if (response.status >= 200 && response.status < 400) {
        const html = await response.text();
        const matches = buildIdRegex.exec(html);

        // Found match in actual buildId and expected buildId
        if (matches && matches.length > 0 && matches[1] === buildId) {
          console.info(
            `URL ${url} is ready as build ID matched. Actual build ID: ${matches[1]}, expected build ID: ${buildId}`
          );
          return true;
        }
      }

      console.info(
        `URL ${url} is not yet ready. Retrying in ${pollInterval} seconds.`
      );
      await new Promise((r) => setTimeout(r, pollInterval * 1000));
    } catch (error) {
      // URL may not return anything, so retry after some time
      if (error.toString().includes("ENOTFOUND")) {
        console.info(
          `URL ${url} is not yet provisioned. Retrying in ${pollInterval} seconds.`
        );
        await new Promise((r) => setTimeout(r, pollInterval * 1000));
      }
    }
  }

  return false;
}

/**
 * Get the Next.js build ID from the .next build directory.
 */
function getNextBuildId(): string | null {
  let data;
  try {
    data = fs.readFileSync(`.next/BUILD_ID`);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("Next BUILD_ID file could not be found.");
      return null;
    } else {
      console.error("Error reading Next BUILD_ID file.");
      return null;
    }
  }
  try {
    return data.toString();
  } catch (err) {
    console.error(`Error: ${err}`);
    return null;
  }
}

/**
 * Get the app bucket name deployed to by serverless-next.js.
 * @param appName
 */
function getAppBucketName(appName: string): string | null {
  let data;
  try {
    data = fs.readFileSync(`.serverless/Template.${appName}.AwsS3.json`);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("S3 JSON file could not be found.");
      return null;
    } else {
      console.error("Error reading S3 JSON file.");
      return null;
    }
  }
  try {
    const struct = JSON.parse(data.toString());
    return struct.name;
  } catch (err) {
    console.error(`Error: ${err}`);
    return null;
  }
}

/**
 * Get the CloudFront URL and distribution ID.
 * @param appName
 */
function getCloudFrontDetails(appName: string): {
  cloudFrontUrl: string | null;
  distributionId: string | null;
} {
  let data;
  try {
    data = fs.readFileSync(`.serverless/Template.${appName}.CloudFront.json`);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("CloudFront JSON file could not be found.");
      return { cloudFrontUrl: null, distributionId: null };
    } else {
      console.error("Error reading CloudFront JSON file.");
      return { cloudFrontUrl: null, distributionId: null };
    }
  }
  try {
    const struct = JSON.parse(data.toString());
    return { cloudFrontUrl: struct.url, distributionId: struct.id };
  } catch (err) {
    console.error(`Error: ${err}`);
    return { cloudFrontUrl: null, distributionId: null };
  }
}

/**
 * Check if a distribution is completely deployed and ready.
 * This means that it has been updated globally, which may take a long time.
 * @param distributionId
 * @param waitDuration
 * @param pollInterval
 */
async function checkCloudFrontDistributionReady(
  distributionId: string,
  waitDuration: number,
  pollInterval: number
): Promise<boolean> {
  const startDate = new Date();
  const startTime = startDate.getTime();
  const waitDurationMillis = waitDuration * 1000;

  while (new Date().getTime() - startTime < waitDurationMillis) {
    const result = await cloudfront
      .getDistribution({ Id: distributionId })
      .promise();

    if (result.Distribution?.Status === "Deployed") {
      return true;
    }

    console.info(
      `Distribution ${distributionId} is not yet ready. Retrying in ${pollInterval} seconds.`
    );
    await new Promise((r) => setTimeout(r, pollInterval * 1000));
  }

  return false;
}

/**
 * Check if all invalidations for the distribution have been completed.
 * @param distributionId
 * @param waitDuration
 * @param pollInterval
 */
async function checkInvalidationsCompleted(
  distributionId: string,
  waitDuration: number,
  pollInterval: number
): Promise<boolean> {
  const startDate = new Date();
  const startTime = startDate.getTime();
  const waitDurationMillis = waitDuration * 1000;

  while (new Date().getTime() - startTime < waitDurationMillis) {
    const result = await cloudfront
      .listInvalidations({ DistributionId: distributionId, MaxItems: "10" })
      .promise();

    let invalidationsCompleted = true;
    for (const invalidationSummary of result.InvalidationList?.Items ?? []) {
      if (invalidationSummary.Status !== "Completed") {
        invalidationsCompleted = false;
        break;
      }
    }

    if (invalidationsCompleted) {
      console.info(`Invalidations for ${distributionId} are completed.`);
      return true;
    }

    console.info(
      `Invalidations for ${distributionId} are not yet completed. Retrying in ${pollInterval} seconds.`
    );
    await new Promise((r) => setTimeout(r, pollInterval * 1000));
  }

  return false;
}

/**
 * Cleanup AWS resources such as emptying the app bucket.
 */
function cleanup(): void {
  if (!alreadyCleaned) {
    // If possible, sync .serverless back to S3
    console.info("Syncing Serverless data back to S3.");
    execSync(
      `aws s3 sync .serverless s3://${deploymentBucketName}/${appName}/.serverless --delete`,
      { stdio: "inherit" }
    );

    // Optimistically clean up app's S3 bucket
    console.info("Optimistically cleaning up app's S3 bucket");
    execSync(
      `aws s3 rm s3://${getAppBucketName(appName)} --recursive || true`,
      {
        stdio: "inherit"
      }
    );

    alreadyCleaned = true;
  }
}

/**
 * Main function to run the end-to-end test.
 */
async function runEndToEndTest(): Promise<boolean> {
  try {
    // Create deployment bucket if doesn't already exist
    console.info(
      `Creating deployment bucket if it doesn't exist: ${deploymentBucketName}`
    );

    execSync(`aws s3 mb s3://${deploymentBucketName} || true`, {
      stdio: "inherit"
    });

    // Sync .serverless from s3
    console.info("Syncing Serverless data from S3.");
    execSync(
      `aws s3 sync s3://${deploymentBucketName}/${appName}/.serverless .serverless --delete`,
      { stdio: "inherit" }
    );

    // Deploy
    console.info("Deploying serverless-next.js app.");
    // execSync("npx @sls-next/serverless-patched --debug", { stdio: "inherit" });
    // The below will always use the latest version in this monorepo, above will use latest published version
    const serverlessPatchedPath = path.join(
      "..",
      "..",
      "libs",
      "serverless-patched",
      "dist",
      "serverless-patched.js"
    );
    execSync(`node ${serverlessPatchedPath} --debug`, { stdio: "inherit" });

    // Get Next.js build ID and URL
    console.info("Getting Next.js build ID");
    const buildId = getNextBuildId();

    if (!buildId) {
      throw new Error("Next.js build ID not found.");
    }

    console.info("Getting CloudFront URL and distribution ID.");
    const { cloudFrontUrl, distributionId } = getCloudFrontDetails(appName);

    if (!cloudFrontUrl || !distributionId) {
      throw new Error("CloudFront url or distribution id not found.");
    }

    // Check that CloudFront distribution is ready
    console.info(
      "Checking if CloudFront invalidations, SSR and SSG pages are ready."
    );
    const [cloudFrontReady, ssrReady, ssgReady, isrReady, dynamicIsrReady] =
      await Promise.all([
        checkInvalidationsCompleted(distributionId, waitTimeout, 10),
        checkWebAppBuildId(
          cloudFrontUrl + ssrPagePath,
          buildId,
          waitTimeout,
          10
        ),
        checkWebAppBuildId(
          cloudFrontUrl + ssgPagePath,
          buildId,
          waitTimeout,
          10
        ),
        isrPagePath
          ? checkWebAppBuildId(
              cloudFrontUrl + isrPagePath,
              buildId,
              waitTimeout,
              10
            )
          : Promise.resolve(true),
        dynamicIsrPagePath
          ? checkWebAppBuildId(
              cloudFrontUrl + dynamicIsrPagePath,
              buildId,
              waitTimeout,
              10
            )
          : Promise.resolve(true)
        // The below is not really needed, as it waits for distribution to be deployed globally, which takes a longer time.
        // checkCloudFrontDistributionReady(distributionId, waitTimeout, 10),
      ]);

    if (
      !cloudFrontReady ||
      !ssrReady ||
      !ssgReady ||
      !isrReady ||
      !dynamicIsrReady
    ) {
      throw new Error("Timed out waiting for app to be ready!");
    }

    // Set Cypress variables to use in e2e tests
    console.info(
      `Setting CYPRESS_BASE_URL=${cloudFrontUrl} and CYPRESS_NEXT_BUILD_ID=${buildId}`
    );

    process.env["CYPRESS_BASE_URL"] = cloudFrontUrl;
    process.env["CYPRESS_NEXT_BUILD_ID"] = buildId;

    // Now run the e2e tests
    console.info("Running e2e tests.");
    execSync("yarn e2e", { stdio: "inherit" });

    return true;
  } catch (error) {
    console.error(`Error: ${error}`);
    return false;
  } finally {
    cleanup();
  }
}

// In case script is exited, ensure cleanup
process.on("exit", cleanup.bind(null, { cleanup: true }));
process.on("SIGINT", cleanup.bind(null, { exit: true }));

runEndToEndTest()
  .then((success) => {
    if (success) {
      console.info("End-to-end test successful.");
      process.exit(0);
    } else {
      console.error("End-to-end test failed.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
