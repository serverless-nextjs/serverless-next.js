import { createComponent } from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockUpdateDistribution,
  mockCreateDistributionWithTagsPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise,
  mockListTagsForResource,
  mockListTagsForResourcePromise,
  mockUntagResource,
  mockTagResource
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("General options propagation", () => {
  let component;

  // sample origins
  const origins = ["https://exampleorigin.com"];

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123",
        ARN: "distributionArn"
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
        Id: "distribution123",
        ARN: "distributionArn"
      }
    });

    component = await createComponent();
  });

  it("create distribution with comment and update it", async () => {
    await component.default({
      comment: "test comment",
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            Comment: "test comment"
          })
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

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            Enabled: false
          })
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

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            Aliases: {
              Items: ["foo.example.com"],
              Quantity: 1
            }
          })
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

  it("update distribution with undefined aliases does not override existing aliases", async () => {
    // Create distribution
    await component.default({ enabled: true, origins });

    // Update distribution
    await component.default({
      enabled: false,
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.not.objectContaining({
          Aliases: expect.anything()
        })
      })
    );
  });

  it("create distribution with priceClass and update it", async () => {
    await component.default({
      priceClass: "PriceClass_All",
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            PriceClass: "PriceClass_All"
          })
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

  it("create distribution with web ACL id and update it", async () => {
    // Create
    await component.default({
      webACLId:
        "arn:aws:wafv2:us-east-1:123456789012:global/webacl/ExampleWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a",
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            WebACLId:
              "arn:aws:wafv2:us-east-1:123456789012:global/webacl/ExampleWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a"
          })
        })
      })
    );

    // Update
    await component.default({
      webACLId:
        "arn:aws:wafv2:us-east-1:123456789012:global/webacl/UpdatedWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a",
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          WebACLId:
            "arn:aws:wafv2:us-east-1:123456789012:global/webacl/UpdatedWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a"
        })
      })
    );
  });

  it("create distribution with web ACL id and delete it", async () => {
    // Create
    await component.default({
      webACLId:
        "arn:aws:wafv2:us-east-1:123456789012:global/webacl/ExampleWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a",
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            WebACLId:
              "arn:aws:wafv2:us-east-1:123456789012:global/webacl/ExampleWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a"
          })
        })
      })
    );

    // Delete
    // Per AWS, providing an empty ACLId will remove the WAF association: https://docs.aws.amazon.com/waf/latest/APIReference/API_DisassociateWebACL.html
    await component.default({
      webACLId: "",
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          WebACLId: ""
        })
      })
    );
  });

  it("create distribution with restrictions and updates it", async () => {
    // Create
    await component.default({
      restrictions: {
        geoRestriction: {
          restrictionType: "blacklist",
          items: ["AA"]
        }
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            Restrictions: {
              GeoRestriction: {
                RestrictionType: "blacklist",
                Quantity: 1,
                Items: ["AA"]
              }
            }
          })
        })
      })
    );

    // Update
    await component.default({
      restrictions: {
        geoRestriction: {
          restrictionType: "blacklist",
          items: ["ZZ"]
        }
      },
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Restrictions: {
            GeoRestriction: {
              RestrictionType: "blacklist",
              Quantity: 1,
              Items: ["ZZ"]
            }
          }
        })
      })
    );
  });

  it("create distribution with restrictions and deletes it", async () => {
    // Create
    await component.default({
      restrictions: {
        geoRestriction: {
          restrictionType: "blacklist",
          items: ["AA"]
        }
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            Restrictions: {
              GeoRestriction: {
                RestrictionType: "blacklist",
                Quantity: 1,
                Items: ["AA"]
              }
            }
          })
        })
      })
    );

    // Delete
    await component.default({
      restrictions: {
        geoRestriction: {
          restrictionType: "none"
        }
      },
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Restrictions: {
            GeoRestriction: {
              RestrictionType: "none",
              Quantity: 0
            }
          }
        })
      })
    );

    // Restriction items not needed when deleting it
    expect.objectContaining({
      DistributionConfig: expect.not.objectContaining({
        Restrictions: {
          GeoRestriction: {
            Items: expect.anything()
          }
        }
      })
    });
  });

  it("create distribution with certificate arn and updates it", async () => {
    // Create
    await component.default({
      certificate: {
        cloudFrontDefaultCertificate: false,
        acmCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            ViewerCertificate: {
              CloudFrontDefaultCertificate: false,
              ACMCertificateArn:
                "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012",
              SSLSupportMethod: "sni-only",
              MinimumProtocolVersion: "TLSv1.2_2019"
            }
          })
        })
      })
    );

    // Update
    await component.default({
      certificate: {
        cloudFrontDefaultCertificate: false,
        acmCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/updated"
      },
      origins
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          ViewerCertificate: {
            CloudFrontDefaultCertificate: false,
            ACMCertificateArn:
              "arn:aws:acm:us-east-1:123456789012:certificate/updated",
            SSLSupportMethod: "sni-only",
            MinimumProtocolVersion: "TLSv1.2_2019"
          }
        })
      })
    );
  });

  it("create distribution with default certificate", async () => {
    // Create
    await component.default({
      certificate: {
        cloudFrontDefaultCertificate: true
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            ViewerCertificate: {
              CloudFrontDefaultCertificate: true,
              SSLSupportMethod: "sni-only",
              MinimumProtocolVersion: "TLSv1.2_2019"
            }
          })
        })
      })
    );
  });

  it("create distribution with IAM certificate", async () => {
    // Create
    await component.default({
      certificate: {
        cloudFrontDefaultCertificate: false,
        iamCertificateId: "12345"
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            ViewerCertificate: {
              CloudFrontDefaultCertificate: false,
              IAMCertificateId: "12345",
              SSLSupportMethod: "sni-only",
              MinimumProtocolVersion: "TLSv1.2_2019"
            }
          })
        })
      })
    );
  });

  it("creates distribution with tags", async () => {
    await component.default({
      tags: {
        tag1: "val1",
        tag2: "val2"
      },
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          Tags: {
            Items: [
              {
                Key: "tag1",
                Value: "val1"
              },
              {
                Key: "tag2",
                Value: "val2"
              }
            ]
          }
        })
      })
    );
  });

  it("updates distribution with tags", async () => {
    mockListTagsForResourcePromise.mockResolvedValueOnce({
      Tags: {
        Items: [{ Key: "existingTag", Tag: "existingValue" }]
      }
    });

    // Create distribution
    await component.default({
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalled();

    // Update distribution
    await component.default({
      tags: {
        tag1: "val1",
        tag2: "val2"
      },
      origins
    });

    expect(mockUpdateDistribution).toBeCalled();

    expect(mockListTagsForResource).toBeCalledWith({
      Resource: "distributionArn"
    });

    expect(mockUntagResource).toBeCalledWith({
      Resource: "distributionArn",
      TagKeys: {
        Items: ["existingTag"]
      }
    });

    expect(mockTagResource).toBeCalledWith({
      Resource: "distributionArn",
      Tags: {
        Items: [
          {
            Key: "tag1",
            Value: "val1"
          },
          {
            Key: "tag2",
            Value: "val2"
          }
        ]
      }
    });
  });
});
