const mockSQS = jest.fn();
const sqs = jest.fn(() => {
  const sqs = mockSQS;
  sqs.init = jest.fn();
  sqs.default = jest.fn();
  sqs.addEventSource = jest.fn();
  sqs.context = {};
  return sqs;
});

sqs.mockSQS = mockSQS;

module.exports = sqs;
