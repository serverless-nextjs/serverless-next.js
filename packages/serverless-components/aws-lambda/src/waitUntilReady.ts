import AWS from "aws-sdk";

/**
 * Wait up to 10 minutes for the Lambda to be ready.
 * This is needed due to: https://docs.aws.amazon.com/lambda/latest/dg/functions-states.html
 */
export const waitUntilReady = async (
  context: any,
  fnName: string,
  region: string,
  pollInterval = 5000
): Promise<boolean> => {
  const lambda: AWS.Lambda = new AWS.Lambda({ region });
  const startDate = new Date();
  const startTime = startDate.getTime();
  const waitDurationMillis = 600000; // 10 minutes max wait time

  context.debug(`Waiting up to 600 seconds for Lambda ${fnName} to be ready.`);

  while (new Date().getTime() - startTime < waitDurationMillis) {
    const {
      Configuration: { LastUpdateStatus, State }
    } = await lambda.getFunction({ FunctionName: fnName }).promise();

    if (State === "Active" && LastUpdateStatus === "Successful") {
      return true;
    }
    await new Promise((r) => setTimeout(r, pollInterval)); // retry every 5 seconds
  }

  return false;
};
