import { postCommentToPullRequest } from "../comment";

export const handler = async (
  event: any = {}
): Promise<{ statusCode: number; body?: string }> => {
  const requestBody = JSON.parse(event.body);
  const prNumber = parseInt(requestBody.prNumber);
  const comment = requestBody.comment;
  const existingSearchString = requestBody.existingSearchString;
  const auth = requestBody.auth;

  // Just a simple check that auth token is passed in
  if (auth !== process.env.AUTH) {
    return {
      statusCode: 401
    };
  }

  // Only allow one type of comment for now
  if (existingSearchString !== "# Handler Size Report") {
    return {
      statusCode: 400
    };
  }

  if (!comment) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "comment is required." })
    };
  }

  if (!prNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "prNumber is required." })
    };
  }

  console.log("Posting comment to pull request");
  try {
    await postCommentToPullRequest(prNumber, comment, existingSearchString);
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }

  return {
    statusCode: 200
  };
};
