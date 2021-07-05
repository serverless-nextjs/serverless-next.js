---
name: Bug report
about: Create a report to help us improve
title: ""
labels: ""
assignees: ""
---

<!-- Thank you for submitting a bug report! Please use the below template to help structure your report. Try to fill out as many details as you can, as Next.js configuration can differ a lot. -->

### Issue Summary
<!-- A short summary of what the bug or issue is. -->

### Actual behavior
<!-- A clear and concise description of what actually happened. -->

### Expected behavior
<!-- A clear and concise description of what you expected to happen. -->

### Steps to reproduce
<!-- Add steps to reproduce the actual behavior. Please try to fill this as specific as possible, it will help us diagnose the issue faster. If you have a GH repo to share a minimal reproduction, that's even better :) -->

### Screenshots/Code/Configuration/Logs
<!-- If applicable, add screenshots or a minimal repro (e.g code or configuration snippet or repository) to help explain your problem. If you have a runtime issue from Lambda/CloudFront, please check CloudWatch logs (note that Lambda@Edge logs are in a region closest to where you access CloudFront - NOT necessarily in `us-east-1` where the original Lambda is created) and post any logs or stacktraces if possible. See here for how to check logs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-testing-debugging.html#lambda-edge-identifying-function-errors. If you have a build or deploy issue, please run with serverless --debug and post the logs. Please also post your serverless.yml. -->

### Versions
<!-- Please add your OS and @sls-next/serverless-component and Next.js versions below. Note that only the last sub-versions within the last two major version of Next.js are officially tested and supported. -->

- OS/Environment:
- @sls-next/serverless-component version:
- Next.js version:

### Additional context
<!-- Add any other context about the problem here. -->

### Checklist
<!-- Please review the following checklist before submitting the issue. -->

- [ ] You have reviewed the [README](https://github.com/serverless-nextjs/serverless-next.js/blob/master/README.md) and [FAQs](https://github.com/serverless-nextjs/serverless-next.js#faq), which answers several common questions.
- [ ] You have reviewed our [DEBUGGING](https://github.com/serverless-nextjs/serverless-next.js/wiki/Debugging-Issues) wiki and have tried your best to include complete information and reproduction steps (including your configuration) as is possible.
- [ ] You have first tried using the most recent `latest` or `alpha` `@sls-next/serverless-component` [release version](https://github.com/serverless-nextjs/serverless-next.js/releases), which may have already fixed your issue or implemented the feature you are trying to use. Note that the old `serverless-next.js` component and the `serverless-next.js` plugin are deprecated and no longer maintained.
