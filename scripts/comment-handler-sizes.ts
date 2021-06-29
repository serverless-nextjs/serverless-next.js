#!/usr/bin/env node

import fetch from "node-fetch";
import { handlerSizeUtils } from "./handler-size-utils";
import { Octokit } from "@octokit/rest";

/**
 * Get sizes that were calculated from existing commit SHA
 * @param commitSha
 */
const getCommitSizes = async (
  commitSha: string
): Promise<Record<string, any>> => {
  const SIZES_URL =
    process.env.SIZES_URL ?? "https://d3m7nebxuhlnm8.cloudfront.net";

  const response = await fetch(
    `${SIZES_URL}/sizes-github-sha-${commitSha}.json`
  );

  return JSON.parse(await response.text());
};

const postCommentToPullRequest = async (
  prNumber: number,
  comment: string
): Promise<void> => {
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });
  await octokit.issues.createComment({
    owner: "serverless-nextjs",
    repo: "serverless-next.js",
    issue_number: prNumber,
    body: comment
  });
};

const main = async (): Promise<void> => {
  const PULL_REQUEST_ID = parseInt(process.env.PULL_REQUEST_ID ?? "0");
  const GITHUB_BASE_SHA = process.env.GITHUB_BASE_SHA ?? "";
  const GITHUB_NEW_SHA = process.env.GITHUB_NEW_SHA ?? "";

  console.info("Get base commit's sizes");

  // Get sizes from base commit
  const baseSizes = await getCommitSizes(GITHUB_BASE_SHA);

  console.info("Calculate all uncompressed handler sizes");

  // Get sizes from current commit
  const newSizes: Record<string, any> = handlerSizeUtils();

  let output = `Base Handler Sizes (kB) (commit ${GITHUB_BASE_SHA}\n`;
  output += "```json";
  output += JSON.stringify(baseSizes + "\n", null, 4);
  output += "```";
  output += `New Handler Sizes (kB) (commit ${GITHUB_NEW_SHA})\n`;
  output += "```json";
  output += JSON.stringify(newSizes + "\n", null, 4);
  output += "```";

  // Post comment to pull request
  await postCommentToPullRequest(PULL_REQUEST_ID, output);
};

main()
  .then(() => {
    console.info("Commented handler sizes successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
