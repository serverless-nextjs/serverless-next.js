import { jest } from "@jest/globals";

const mockWaitUtilReady = jest.fn();

module.exports = {
  mockWaitUtilReady,
  waitUntilReady: mockWaitUtilReady
};
