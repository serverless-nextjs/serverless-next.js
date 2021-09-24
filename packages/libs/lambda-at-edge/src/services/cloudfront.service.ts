import { CloudFrontClient } from "@aws-sdk/client-cloudfront/CloudFrontClient";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { debug } from "../lib/console";

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
}
