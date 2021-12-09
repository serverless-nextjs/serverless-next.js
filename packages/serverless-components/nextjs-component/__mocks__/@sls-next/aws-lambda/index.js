const mockLambda = jest.fn();
const mockLambdaPublish = jest.fn();
const lambda = jest.fn(() => {
  const lambda = mockLambda;
  lambda.init = () => {};
  lambda.default = () => {};
  lambda.context = {};
  lambda.publishVersion = mockLambdaPublish;
  return lambda;
});

lambda.mockLambda = mockLambda;
lambda.mockLambdaPublish = mockLambdaPublish;

module.exports = lambda;
