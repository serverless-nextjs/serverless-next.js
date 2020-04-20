const Serverless = require("serverless");
const {
  mockDescribeStacksPromise,
  mockCreateStackPromise,
  mockDescribeStackEventsPromise,
  mockDescribeStackResourcePromise,
  mockListObjectsV2Promise,
  mockGetCallerIdentityPromise,
  mockUpdateStackPromise,
  mockGetRestApisPromise
} = require("aws-sdk");

const setupMocks = () => {
  // these mocks are necessary for running "serverless deploy"

  // pretend serverless stack doesn't exist first
  mockDescribeStacksPromise.mockRejectedValueOnce(
    new Error("Stack does not exist.")
  );

  // create stack result OK
  mockCreateStackPromise.mockResolvedValue({ StackId: "MockedStack" });

  // mock a stack event for monitorStack.js
  var aYearFromNow = new Date();
  aYearFromNow.setFullYear(aYearFromNow.getFullYear() + 1);
  mockDescribeStackEventsPromise.mockResolvedValue({
    StackEvents: [
      {
        StackId: "MockedStack",
        ResourceType: "AWS::CloudFormation::Stack",
        ResourceStatus: "CREATE_COMPLETE",
        Timestamp: aYearFromNow
      }
    ]
  });

  mockDescribeStackResourcePromise.mockResolvedValue({
    StackResourceDetail: {
      StackId: "MockedStack",
      PhysicalResourceId: "MockedStackPhysicalResourceId"
    }
  });

  mockListObjectsV2Promise.mockResolvedValue({ Contents: [] });

  mockGetCallerIdentityPromise.mockResolvedValue({
    Arn: "arn:aws:iam:testAcctId:testUser/xyz"
  });

  mockUpdateStackPromise.mockResolvedValueOnce({
    StackId: "MockedStack"
  });

  mockDescribeStacksPromise.mockResolvedValueOnce({
    Stacks: [
      {
        StackId: "MockedStack",
        Outputs: []
      }
    ]
  });

  mockGetRestApisPromise.mockResolvedValueOnce({
    items: [{ id: "mockedApi" }]
  });
};

module.exports = async (servicePath, command) => {
  setupMocks(command);

  const tmpCwd = process.cwd();

  process.chdir(servicePath);

  try {
    // Hack to get serverless to think user is calling "serverless [command]" e.g. serverless package
    // See https://github.com/serverless/serverless/blob/master/lib/utils/resolveCliInput.js
    const tmpProcessArgv = process.argv;
    process.argv = [undefined, undefined, command];

    const serverless = new Serverless();

    serverless.invocationId = "test-run";

    jest.useFakeTimers();
    setTimeout.mockImplementation(cb => cb());

    await serverless.init();
    await serverless.run();

    process.argv = tmpProcessArgv;

    jest.useRealTimers();
  } catch (err) {
    console.error(`Serverless command ${command} crashed.`, err);
    throw err;
  }

  process.chdir(tmpCwd);
};
