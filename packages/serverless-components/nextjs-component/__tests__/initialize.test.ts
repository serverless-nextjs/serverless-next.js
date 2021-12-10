import AWS from "aws-sdk";
import NextjsComponent from "../src/component";

jest.mock("aws-sdk", () => {
  const mockConfig = {
    update: jest.fn()
  };
  return {
    ...jest.requireActual("aws-sdk"),
    config: mockConfig
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
    expect(AWS.config.update).toBeCalled();
  });
});
