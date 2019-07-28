const Serverless = require("serverless");
const {
  mockDescribeStacks,
  mockCreateStack,
  mockDescribeStackEvents,
  mockDescribeStackResource,
  mockListObjectsV2,
  mockGetCallerIdentity,
  mockUpdateStack,
  mockGetRestApis
} = require("aws-sdk");

const setupMocks = () => {
  // these mocks are necessary for running "serverless deploy"

  // pretend serverless stack doesn't exist first
  mockDescribeStacks.mockReturnValueOnce({
    promise: () => Promise.reject(new Error("Stack does not exist."))
  });

  // create stack result OK
  mockCreateStack.mockReturnValue({
    promise: () => Promise.resolve({ StackId: "MockedStack" })
  });

  // mock a stack event for monitorStack.js
  var aYearFromNow = new Date();
  aYearFromNow.setFullYear(aYearFromNow.getFullYear() + 1);
  mockDescribeStackEvents.mockReturnValue({
    promise: () =>
      Promise.resolve({
        StackEvents: [
          {
            StackId: "MockedStack",
            ResourceType: "AWS::CloudFormation::Stack",
            ResourceStatus: "CREATE_COMPLETE",
            Timestamp: aYearFromNow
          }
        ]
      })
  });

  mockDescribeStackResource.mockReturnValue({
    promise: () =>
      Promise.resolve({
        StackResourceDetail: {
          StackId: "MockedStack",
          PhysicalResourceId: "MockedStackPhysicalResourceId"
        }
      })
  });

  mockListObjectsV2.mockReturnValue({
    promise: () => Promise.resolve({ Contents: [] })
  });

  mockGetCallerIdentity.mockReturnValue({
    promise: () =>
      Promise.resolve({ Arn: "arn:aws:iam:testAcctId:testUser/xyz" })
  });

  mockUpdateStack.mockReturnValueOnce({
    promise: () =>
      Promise.resolve({
        StackId: "MockedStack"
      })
  });

  mockDescribeStacks.mockReturnValueOnce({
    promise: () =>
      Promise.resolve({
        Stacks: [
          {
            StackId: "MockedStack",
            Outputs: []
          }
        ]
      })
  });

  mockGetRestApis.mockReturnValueOnce({
    promise: () =>
      Promise.resolve({
        items: [{ id: "mockedApi" }]
      })
  });
};

module.exports = async (servicePath, command) => {
  setupMocks();

  const tmpCwd = process.cwd();

  process.chdir(servicePath);

  try {
    const serverless = new Serverless();

    serverless.invocationId = "test-run";

    process.argv[2] = command;

    jest.useFakeTimers();
    setTimeout.mockImplementation(cb => cb());

    await serverless.init();
    await serverless.run();

    jest.useRealTimers();
  } catch (err) {
    console.error(`Serverless command ${command} crashed.`, err);
    throw err;
  }

  process.chdir(tmpCwd);
};
