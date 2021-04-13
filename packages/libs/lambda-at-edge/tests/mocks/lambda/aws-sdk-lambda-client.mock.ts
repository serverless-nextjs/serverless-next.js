export const mockSend = jest.fn();

const MockLambdaClient = jest.fn(() => ({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor: () => {},
  send: mockSend
}));

export { MockLambdaClient as LambdaClient };
