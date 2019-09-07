## Getting started

### Bootstrap your next app

```
npx create-next-app
cd yourProjectName
```

### Set serverless mode

```js
// next.config.js
module.exports = {
  target: "serverless"
};
```

### Add your AWS credentials

```bash
# .env file
AWS_ACCESS_KEY_ID=accessKey
AWS_SECRET_ACCESS_KEY=sshh
```

### Add the serverless.yml config

```yaml
nextApp:
  component: "@serverless/nextjs"
```

### Deploy

`npx serverless`
