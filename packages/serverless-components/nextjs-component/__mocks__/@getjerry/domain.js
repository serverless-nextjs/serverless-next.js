const mockDomain = jest.fn();
const domain = jest.fn(() => {
  const domain = mockDomain;
  domain.init = () => {};
  domain.default = () => {};
  domain.context = {};
  return domain;
});

domain.mockDomain = mockDomain;

module.exports = domain;
