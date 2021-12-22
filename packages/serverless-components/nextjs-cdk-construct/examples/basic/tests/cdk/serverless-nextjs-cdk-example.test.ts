import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import { App } from 'aws-cdk-lib';
import * as ServerlessNextjsCdkExample from '../../cdk/serverless-nextjs-cdk-example-stack';

test('Empty Stack', () => {
    const app = new App();
    // WHEN
    const stack = new ServerlessNextjsCdkExample.ServerlessNextjsCdkExampleStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
