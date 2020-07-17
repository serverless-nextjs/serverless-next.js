const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockCreateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise,
  mockCreateCloudFrontOriginAccessIdentityPromise,
  mockPutBucketPolicy
} = require("aws-sdk");

const { createComponent, assertHasOrigin } = require("../test-utils");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("S3 origins", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distributionwithS3origin"
      }
    });

    component = await createComponent();
  });

  describe("When origin is an S3 bucket URL", () => {
    it("creates distribution", async () => {
      await component.default({
        origins: ["https://mybucket.s3.amazonaws.com"]
      });

      assertHasOrigin(mockCreateDistribution, {
        Id: "mybucket",
        DomainName: "mybucket.s3.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity: ""
        },
        CustomHeaders: {
          Quantity: 0,
          Items: []
        },
        OriginPath: ""
      });

      expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
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
          Id: "distributionwithS3originupdated"
        }
      });

      await component.default({
        origins: ["https://mybucket.s3.amazonaws.com"]
      });

      await component.default({
        origins: ["https://anotherbucket.s3.amazonaws.com"]
      });

      assertHasOrigin(mockUpdateDistribution, {
        Id: "anotherbucket",
        DomainName: "anotherbucket.s3.amazonaws.com"
      });

      expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe("When origin is an S3 URL only accessible via CloudFront", () => {
    it("creates distribution", async () => {
      mockCreateCloudFrontOriginAccessIdentityPromise.mockResolvedValueOnce({
        CloudFrontOriginAccessIdentity: {
          Id: "access-identity-xyz",
          S3CanonicalUserId: "s3-canonical-user-id-xyz"
        }
      });

      await component.default({
        origins: [
          {
            url: "https://mybucket.s3.amazonaws.com",
            private: true
          }
        ]
      });

      expect(mockPutBucketPolicy).toBeCalledWith({
        Bucket: "mybucket",
        Policy: expect.stringContaining(
          '"CanonicalUser":"s3-canonical-user-id-xyz"'
        )
      });

      assertHasOrigin(mockCreateDistribution, {
        Id: "mybucket",
        DomainName: "mybucket.s3.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity:
            "origin-access-identity/cloudfront/access-identity-xyz"
        },
        CustomHeaders: {
          Quantity: 0,
          Items: []
        },
        OriginPath: ""
      });

      expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
      mockCreateCloudFrontOriginAccessIdentityPromise.mockResolvedValue({
        CloudFrontOriginAccessIdentity: {
          Id: "access-identity-xyz",
          S3CanonicalUserId: "s3-canonical-user-id-xyz"
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
          Id: "distributionwithS3originupdated"
        }
      });

      await component.default({
        origins: [
          {
            url: "https://mybucket.s3.amazonaws.com",
            private: true
          }
        ]
      });

      await component.default({
        origins: [
          {
            url: "https://anotherbucket.s3.amazonaws.com",
            private: true
          }
        ]
      });

      expect(mockPutBucketPolicy).toBeCalledWith({
        Bucket: "anotherbucket",
        Policy: expect.stringContaining(
          '"CanonicalUser":"s3-canonical-user-id-xyz"'
        )
      });

      assertHasOrigin(mockUpdateDistribution, {
        Id: "anotherbucket",
        DomainName: "anotherbucket.s3.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity:
            "origin-access-identity/cloudfront/access-identity-xyz"
        },
        OriginPath: "",
        CustomHeaders: { Items: [], Quantity: 0 }
      });

      expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe("when origin is outside of us-east-1", () => {
    it("should use the origin's host at the DomainName", async () => {
      await component.default({
        origins: ["https://mybucket.s3.eu-west-1.amazonaws.com"]
      });

      assertHasOrigin(mockCreateDistribution, {
        Id: "mybucket",
        DomainName: "mybucket.s3.eu-west-1.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity: ""
        },
        CustomHeaders: {
          Quantity: 0,
          Items: []
        },
        OriginPath: ""
      });

      expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
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
          Id: "distributionwithS3originupdated"
        }
      });

      await component.default({
        origins: ["https://mybucket.s3.eu-west-1.amazonaws.com"]
      });

      await component.default({
        origins: ["https://anotherbucket.s3.eu-west-1.amazonaws.com"]
      });

      assertHasOrigin(mockUpdateDistribution, {
        Id: "anotherbucket",
        DomainName: "anotherbucket.s3.eu-west-1.amazonaws.com"
      });

      expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
