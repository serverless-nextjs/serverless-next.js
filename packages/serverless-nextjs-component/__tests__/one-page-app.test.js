const NextjsComponent = require("../serverless");

describe("One page application", () => {
  beforeAll(async () => {
    const component = new NextjsComponent();

    await component.init();
    await component.default({});
  });

  it("passes", () => {
    expect(true).toBe(true);
  });
});
