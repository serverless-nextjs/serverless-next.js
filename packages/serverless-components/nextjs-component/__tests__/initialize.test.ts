import NextjsComponent from "../src/component";

jest.mock("aws-sdk", () => {
  return {
    ...jest.requireActual("aws-sdk"),
    Config: jest.fn(() => {
      // intentionally empty
    })
  };
});

describe("Initialize tests", () => {
  beforeEach(() => {
    const component = new NextjsComponent();
    component.context.credentials = {
      aws: {
        accessKeyId: "123",
        secretAccessKey: "456"
      }
    };

    component.context.instance.debugMode = true;

    component.initialize();
  });

  it("sets stack trace limit", () => {
    expect(Error.stackTraceLimit).toBe(100);
  });

  it("sets AWS config correctly", () => {
    const AWS = require("aws-sdk");
    expect(AWS.Config).toBeCalled();
  });
});
