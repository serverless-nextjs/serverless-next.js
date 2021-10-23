import { jest } from "@jest/globals";

const mockRemoveLambdaVersions = jest.fn();

module.exports = {
  mockRemoveLambdaVersions,
  removeLambdaVersions: mockRemoveLambdaVersions
};
