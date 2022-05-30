import { CloudFrontClient } from "@aws-sdk/client-cloudfront/CloudFrontClient";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { debug } from "../lib/console";
import { gql, GraphQLClient } from "graphql-request";

interface CloudFrontServiceOptions {
  distributionId: string;
}

export class CloudFrontService {
  constructor(
    private readonly client: CloudFrontClient,
    private readonly options: CloudFrontServiceOptions
  ) {}

  public async createInvalidation(paths: string[]): Promise<void> {
    if (!this.options.distributionId) {
      throw new Error("Distribution id is not provided");
    }
    debug(`[cloudfront] Invalidate paths: ${JSON.stringify(paths)}`);

    paths.map((path) => {
      console.log(`[cloudfront] ISR Invalidate paths: ${path}`);
    });

    const res = await this.client.send(
      new CreateInvalidationCommand({
        DistributionId: this.options.distributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: paths.length,
            Items: [...paths]
          }
        }
      })
    );
  }

  public async createRemoteInvalidation(
    paths: string[],
    env: string
  ): Promise<void> {
    const endpoint = `https://cdn-invalidation.${env}.getjerry.com/api/cdn-invalidation/graphql`;

    const graphQLClient = new GraphQLClient(endpoint);

    const mutation = gql`
      mutation createRemoteInvalidation($urls: [String!]!) {
        invalidationUrls(urls: $urls)
      }
    `;

    debug(`[createRemoteInvalidation] send to ${endpoint}`);
    const data = await graphQLClient.request(mutation, {
      urls: paths
    });
    debug(`[createRemoteInvalidation] result is ${JSON.stringify(data)}`);
  }
}
