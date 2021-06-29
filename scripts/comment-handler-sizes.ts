#!/usr/bin/env node

import fetch from "node-fetch";
import { calculateHandlerSizes } from "./handler-size-utils";
import { Octokit } from "@octokit/rest";
import * as _ from "lodash";

/**
 * Get sizes that were calculated from existing commit SHA
 * @param commitSha
 */
const getCommitSizes = async (
  commitSha: string
): Promise<Record<string, any>> => {
  const SIZES_URL =
    process.env.SIZES_URL ?? "https://d3m7nebxuhlnm8.cloudfront.net";

  const url = `${SIZES_URL}/sizes-github-sha-${commitSha}.json`;

  console.info("Retrieving url at: " + url);

  const response = await fetch(url);

  if (response.ok) {
    return JSON.parse(await response.text());
  } else {
    console.warn(
      "Unable to get commit sizes due to response status: " + response.status
    );
    return {};
  }
};

const postCommentToPullRequest = async (
  prNumber: number,
  comment: string
): Promise<void> => {
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });

  // Try to find existing report comment
  const comments = await octokit.issues.listComments({
    owner: "serverless-nextjs",
    repo: "serverless-next.js",
    issue_number: prNumber
  });

  let existingCommentId;

  for (const comment of comments.data) {
    if (
      comment.body?.includes("# Handler Size Report") &&
      comment.user?.login === "slsnextbot"
    ) {
      existingCommentId = comment.id;
      break;
    }
  }

  if (existingCommentId) {
    await octokit.issues.updateComment({
      comment_id: existingCommentId,
      owner: "serverless-nextjs",
      repo: "serverless-next.js",
      issue_number: prNumber,
      body: comment
    });
  } else {
    await octokit.issues.createComment({
      owner: "serverless-nextjs",
      repo: "serverless-next.js",
      issue_number: prNumber,
      body: comment
    });
  }
};

const main = async (): Promise<void> => {
  const PULL_REQUEST_ID = parseInt(process.env.PULL_REQUEST_ID ?? "0");
  const GITHUB_BASE_SHA = process.env.GITHUB_BASE_SHA ?? "";
  const GITHUB_NEW_SHA = process.env.GITHUB_NEW_SHA ?? "";

  console.info("Get base commit's sizes");

  // Get sizes from base branch commit
  const baseSizes = await getCommitSizes(GITHUB_BASE_SHA);

  console.info("Calculate all uncompressed handler sizes");

  // Get sizes from PR branch latest commit
  const newSizes: Record<string, any> = calculateHandlerSizes();

  let output = "# Handler Size Report\n";

  if (_.isEqual(baseSizes, newSizes)) {
    output += "> No changes to handler sizes.\n";
  } else {
    output += "> There are changes to handler sizes. Please review.\n";
  }

  output += `### Base Handler Sizes (kB) (commit ${GITHUB_BASE_SHA})\n`;
  output += "```ts\n";
  output += JSON.stringify(baseSizes, null, 4) + "\n";
  output += "```\n";
  output += `### New Handler Sizes (kB) (commit ${GITHUB_NEW_SHA})\n`;
  output += "```ts\n";
  output += JSON.stringify(newSizes, null, 4) + "\n";
  output += "```\n";

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
