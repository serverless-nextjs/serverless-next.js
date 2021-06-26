const { tmpdir } = require("os");
const path = require("path");
const archiver = require("archiver");
const globby = require("globby");
const { contains, isNil, last, split, equals, not, pick } = require("ramda");
const { readFile, createReadStream, createWriteStream } = require("fs-extra");
const { utils } = require("@serverless/core");
const _ = require("lodash");

const VALID_FORMATS = ["zip", "tar"];
const isValidFormat = (format) => contains(format, VALID_FORMATS);

const packDir = async (
  inputDirPath,
  outputFilePath,
  include = [],
  exclude = [],
  prefix
) => {
  const format = last(split(".", outputFilePath));

  if (!isValidFormat(format)) {
    throw new Error('Please provide a valid format. Either a "zip" or a "tar"');
  }

  const patterns = ["**/*"];

  if (!isNil(exclude)) {
    exclude.forEach((excludedItem) => patterns.push(`!${excludedItem}`));
  }

  const files = (await globby(patterns, { cwd: inputDirPath, dot: true }))
    .sort() // we must sort to ensure correct hash
    .map((file) => ({
      input: path.join(inputDirPath, file),
      output: prefix ? path.join(prefix, file) : file
    }));

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputFilePath);
    const archive = archiver(format, {
      zlib: { level: 9 }
    });

    output.on("open", () => {
      archive.pipe(output);

      // we must set the date to ensure correct hash
      files.forEach((file) =>
        archive.append(createReadStream(file.input), {
          name: file.output,
          date: new Date(0)
        })
      );

      if (!isNil(include)) {
        include.forEach((file) => {
          const stream = createReadStream(file);
          archive.append(stream, {
            name: path.basename(file),
            date: new Date(0)
          });
        });
      }

      archive.finalize();
    });

    archive.on("error", (err) => reject(err));
    output.on("close", () => resolve(outputFilePath));
  });
};

const getAccountId = async (aws) => {
  const STS = new aws.STS();
  const res = await STS.getCallerIdentity({}).promise();
  return res.Account;
};

const createLambda = async ({
  lambda,
  name,
  handler,
  memory,
  timeout,
  runtime,
  env,
  description,
  zipPath,
  bucket,
  role,
  layer,
  tags
}) => {
  const params = {
    FunctionName: name,
    Code: {},
    Description: description,
    Handler: handler,
    MemorySize: memory,
    Publish: true,
    Role: role.arn,
    Runtime: runtime,
    Timeout: timeout,
    Environment: {
      Variables: env
    },
    Tags: tags
  };

  if (layer && layer.arn) {
    params.Layers = [layer.arn];
  }

  if (bucket) {
    params.Code.S3Bucket = bucket;
    params.Code.S3Key = path.basename(zipPath);
  } else {
    params.Code.ZipFile = await readFile(zipPath);
  }

  const res = await lambda.createFunction(params).promise();

  return { arn: res.FunctionArn, hash: res.CodeSha256 };
};

const updateLambdaConfig = async ({
  lambda,
  name,
  handler,
  memory,
  timeout,
  runtime,
  env,
  description,
  role,
  layer,
  tags
}) => {
  const functionConfigParams = {
    FunctionName: name,
    Description: description,
    Handler: handler,
    MemorySize: memory,
    Role: role.arn,
    Runtime: runtime,
    Timeout: timeout,
    Environment: {
      Variables: env
    }
  };

  if (layer && layer.arn) {
    functionConfigParams.Layers = [layer.arn];
  }

  const res = await lambda
    .updateFunctionConfiguration(functionConfigParams)
    .promise();

  // Get and update Lambda tags only if tags are specified (for backwards compatibility and avoiding unneeded updates)
  if (tags) {
    const listTagsResponse = await lambda
      .listTags({ Resource: res.FunctionArn })
      .promise();
    const currentTags = listTagsResponse.Tags;

    // If tags are not the same then update them
    if (!_.isEqual(currentTags, tags)) {
      if (currentTags && Object.keys(currentTags).length > 0)
        await lambda
          .untagResource({
            Resource: res.FunctionArn,
            TagKeys: Object.keys(currentTags)
          })
          .promise();

      if (Object.keys(tags).length > 0)
        await lambda
          .tagResource({
            Resource: res.FunctionArn,
            Tags: tags
          })
          .promise();
    }
  }

  return { arn: res.FunctionArn, hash: res.CodeSha256 };
};

const updateLambdaCode = async ({ lambda, name, zipPath, bucket }) => {
  const functionCodeParams = {
    FunctionName: name,
    Publish: true
  };

  if (bucket) {
    functionCodeParams.S3Bucket = bucket;
    functionCodeParams.S3Key = path.basename(zipPath);
  } else {
    functionCodeParams.ZipFile = await readFile(zipPath);
  }
  const res = await lambda.updateFunctionCode(functionCodeParams).promise();

  return res.FunctionArn;
};

const getLambda = async ({ lambda, name }) => {
  try {
    const res = await lambda
      .getFunctionConfiguration({
        FunctionName: name
      })
      .promise();

    return {
      name: res.FunctionName,
      description: res.Description,
      timeout: res.Timeout,
      runtime: res.Runtime,
      role: {
        arn: res.Role
      },
      handler: res.Handler,
      memory: res.MemorySize,
      hash: res.CodeSha256,
      env: res.Environment ? res.Environment.Variables : {},
      arn: res.FunctionArn
    };
  } catch (e) {
    if (e.code === "ResourceNotFoundException") {
      return null;
    }
    throw e;
  }
};

const deleteLambda = async ({ lambda, name }) => {
  try {
    const params = { FunctionName: name };
    await lambda.deleteFunction(params).promise();
  } catch (error) {
    if (error.code !== "ResourceNotFoundException") {
      throw error;
    }
  }
};

const getPolicy = async ({ name, region, accountId }) => {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Action: ["logs:CreateLogStream"],
        Resource: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${name}:*`
        ],
        Effect: "Allow"
      },
      {
        Action: ["logs:PutLogEvents"],
        Resource: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${name}:*:*`
        ],
        Effect: "Allow"
      }
    ]
  };
};

const configChanged = (prevLambda, lambda) => {
  const keys = [
    "description",
    "runtime",
    "role",
    "handler",
    "memory",
    "timeout",
    "env",
    "hash"
  ];
  const inputs = pick(keys, lambda);
  inputs.role = { arn: inputs.role.arn }; // remove other inputs.role component outputs
  const prevInputs = pick(keys, prevLambda);
  return not(equals(inputs, prevInputs));
};

const pack = async (code, shims = [], packDeps = true) => {
  if (utils.isArchivePath(code)) {
    return path.resolve(code);
  }

  let exclude = [];

  if (!packDeps) {
    exclude = ["node_modules/**"];
  }

  const outputFilePath = path.join(
    tmpdir(),
    `${Math.random().toString(36).substring(6)}.zip`
  );

  return packDir(code, outputFilePath, shims, exclude);
};

module.exports = {
  createLambda,
  updateLambdaCode,
  updateLambdaConfig,
  getLambda,
  deleteLambda,
  getPolicy,
  getAccountId,
  configChanged,
  pack
};
