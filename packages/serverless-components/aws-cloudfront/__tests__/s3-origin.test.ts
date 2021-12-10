import {
  mockCreateDistributionWithTags,
  mockUpdateDistribution,
  mockCreateDistributionWithTagsPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise,
  mockCreateCloudFrontOriginAccessIdentityPromise,
  mockGetCloudFrontOriginAccessIdentityPromise,
  mockPutBucketPolicy
} from "../__mocks__/aws-sdk.mock";
import {
  createComponent,
  assertHasOrigin,
  assertCDWTHasOrigin
} from "../test-utils";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("S3 origins", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
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

      assertCDWTHasOrigin(mockCreateDistributionWithTags, {
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

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
      mockGetDistributionConfigPromise.mockResolvedValueOnce({
        ETag: "etag",
        DistributionConfig: {
          Origins: {
            Quantity: 0,
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

      assertCDWTHasOrigin(mockCreateDistributionWithTags, {
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

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
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
            Quantity: 0,
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

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution persisting existing identity", async () => {
      mockGetCloudFrontOriginAccessIdentityPromise.mockResolvedValue({
        CloudFrontOriginAccessIdentity: {
          Id: "access-identity-1",
          S3CanonicalUserId: "s3-canonical-user-id-1"
        }
      });

      mockGetDistributionConfigPromise.mockResolvedValueOnce({
        ETag: "etag",
        DistributionConfig: {
          Origins: {
            Quantity: 0,
            Items: []
          }
        }
      });

      mockUpdateDistributionPromise.mockResolvedValueOnce({
        Distribution: {
          Id: "distributionwithS3origin"
        }
      });

      await component.default({
        distributionId: "distributionwithS3origin",
        origins: [
          {
            url: "https://anotherbucket.s3.amazonaws.com",
            private: true
          }
        ],
        originAccessIdentityId: "access-identity-1"
      });

      expect(mockPutBucketPolicy).toBeCalledWith({
        Bucket: "anotherbucket",
        Policy: expect.stringContaining(
          '"CanonicalUser":"s3-canonical-user-id-1"'
        )
      });

      assertHasOrigin(mockUpdateDistribution, {
        Id: "anotherbucket",
        DomainName: "anotherbucket.s3.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity:
            "origin-access-identity/cloudfront/access-identity-1"
        },
        OriginPath: "",
        CustomHeaders: { Items: [], Quantity: 0 }
      });

      expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe("when origin is outside of us-east-1", () => {
    it("should use the origin's host at the DomainName", async () => {
      await component.default({
        origins: ["https://mybucket.s3.eu-west-1.amazonaws.com"]
      });

      assertCDWTHasOrigin(mockCreateDistributionWithTags, {
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

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
      mockGetDistributionConfigPromise.mockResolvedValueOnce({
        ETag: "etag",
        DistributionConfig: {
          Origins: {
            Quantity: 0,
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

  describe("when origin is outside of us-east-1 and contains dots", () => {
    it("should use the origin's host at the DomainName", async () => {
      await component.default({
        origins: ["https://mybucket.with.dots.s3.eu-west-1.amazonaws.com"]
      });

      assertCDWTHasOrigin(mockCreateDistributionWithTags, {
        Id: "mybucket.with.dots",
        DomainName: "mybucket.with.dots.s3.eu-west-1.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity: ""
        },
        CustomHeaders: {
          Quantity: 0,
          Items: []
        },
        OriginPath: ""
      });

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
      mockGetDistributionConfigPromise.mockResolvedValueOnce({
        ETag: "etag",
        DistributionConfig: {
          Origins: {
            Quantity: 0,
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
        origins: ["https://mybucket.with.dots.s3.eu-west-1.amazonaws.com"]
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

  describe("when origin is outside of us-east-1 and contains s3 and dots", () => {
    it("should use the origin's host at the DomainName", async () => {
      await component.default({
        origins: ["https://mybucket.s3.s3.s3.eu-west-1.amazonaws.com"]
      });

      assertCDWTHasOrigin(mockCreateDistributionWithTags, {
        Id: "mybucket.s3.s3",
        DomainName: "mybucket.s3.s3.s3.eu-west-1.amazonaws.com",
        S3OriginConfig: {
          OriginAccessIdentity: ""
        },
        CustomHeaders: {
          Quantity: 0,
          Items: []
        },
        OriginPath: ""
      });

      expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
    });

    it("updates distribution", async () => {
      mockGetDistributionConfigPromise.mockResolvedValueOnce({
        ETag: "etag",
        DistributionConfig: {
          Origins: {
            Quantity: 0,
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
        origins: ["https://mybucket.s3.s3.s3.eu-west-1.amazonaws.com"]
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
