export const mockSend = jest.fn();

const MockCloudFrontClient = jest.fn(() => ({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor: () => {},
  send: mockSend
}));

export { MockCloudFrontClient as CloudFrontClient };
