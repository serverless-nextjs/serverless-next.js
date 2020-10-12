const { createComponent } = require("../test-utils");

const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockCreateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("General options propagation", () => {
  let component;

  // sample origins
  const origins = ["https://exampleorigin.com"];

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123"
      }
    });

    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Origins: {
          Items: []
        }
      }
    });
    mockUpdateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "xyz"
      }
    });

    component = await createComponent();
  });

  it("create distribution with comment and update it", async () => {
    await component.default({
      comment: "test comment",
      origins
    });

    expect(mockCreateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Comment: "test comment"
        })
      })
    );

    await component.default({
      comment: "updated comment",
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Comment: "updated comment"
        })
      })
    );
  });

  it("create disabled distribution and update it", async () => {
    await component.default({
      enabled: false,
      origins
    });

    expect(mockCreateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Enabled: false
        })
      })
    );

    await component.default({
      enabled: true,
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Enabled: true
        })
      })
    );
  });

  it("create distribution with aliases and update it", async () => {
    await component.default({
      aliases: ["foo.example.com"],
      origins
    });

    expect(mockCreateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Aliases: {
            Items: ["foo.example.com"],
            Quantity: 1
          }
        })
      })
    );

    await component.default({
      aliases: ["bar.example.com"],
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Aliases: {
            Items: ["bar.example.com"],
            Quantity: 1
          }
        })
      })
    );
  });

  it("create distribution with priceClass and update it", async () => {
    await component.default({
      priceClass: "PriceClass_All",
      origins
    });

    expect(mockCreateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          PriceClass: "PriceClass_All"
        })
      })
    );

    await component.default({
      priceClass: "PriceClass_100",
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          PriceClass: "PriceClass_100"
        })
      })
    );
  });
});
