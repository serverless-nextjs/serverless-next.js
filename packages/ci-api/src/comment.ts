import { Octokit } from "@octokit/rest";

export const postCommentToPullRequest = async (
  prNumber: number,
  comment: string,
  existingSearchString?: string
): Promise<void> => {
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });

  // Here is how we lock down the API.
  // Basically anyone could potentially call this (but it is acceptable) so we need to make it a bit safer

  // Ensure comment size is reasonable.
  if (comment.length > 3000) {
    throw Error("Comment length is too long.");
  }

  // Issue must be a valid PR and currently open for the commenter to work
  const pullRequestResponse = await octokit.issues.get({
    owner: "serverless-nextjs",
    repo: "serverless-next.js",
    issue_number: prNumber
  });

  // Could not find the issue number
  if (pullRequestResponse.status !== 200) {
    throw Error("Unable to find pull request.");
  }

  const pullRequest = pullRequestResponse.data;

  // Not a pull request or it has already been closed
  if (!pullRequest.pull_request) {
    throw Error("Not a pull request.");
  }

  if (pullRequest.state === "closed") {
    throw Error("Pull request is already cloesd.");
  }

  // Try to find existing report comment if applicable
  let existingCommentId;

  if (existingSearchString) {
    const commentsResponse = await octokit.issues.listComments({
      owner: "serverless-nextjs",
      repo: "serverless-next.js",
      issue_number: prNumber
    });

    for (const comment of commentsResponse.data) {
      if (
        comment.body?.includes(existingSearchString) &&
        comment.user?.login === "slsnextbot"
      ) {
        existingCommentId = comment.id;
        break;
      }
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
