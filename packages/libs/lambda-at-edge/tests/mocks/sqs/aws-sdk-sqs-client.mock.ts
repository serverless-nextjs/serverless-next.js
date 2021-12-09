import { jest } from "@jest/globals";

const mockSQSClient = jest.fn();
const mockSendMessageCommand = jest.fn();

export {
  mockSQSClient as SQSClient,
  mockSendMessageCommand as SendMessageCommand,
  mockSQSClient,
  mockSendMessageCommand
};
