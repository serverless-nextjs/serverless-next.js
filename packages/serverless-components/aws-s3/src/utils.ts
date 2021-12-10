import AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import klawSync from "klaw-sync";
import mime from "mime-types";
import UploadStream from "s3-stream-upload";
import { isEmpty } from "ramda";
import { createReadStream } from "fs-extra";
import * as archiver from "archiver";
import { utils } from "@serverless/core";
import * as _ from "lodash";

const getClients = (credentials, region) => {
  const params = {
    region,
    credentials
  };

  // we need two S3 clients because creating/deleting buckets
  // is not available with the acceleration feature.
  return {
    regular: new AWS.S3(params),
    accelerated: new AWS.S3({
      ...params,
      endpoint: `s3-accelerate.amazonaws.com`
    })
  };
};

const bucketCreation = async (s3: AWS.S3, Bucket: string) => {
  try {
    await s3.headBucket({ Bucket }).promise();
  } catch (e) {
    if (e.code === "NotFound" || e.code === "NoSuchBucket") {
      await utils.sleep(2000);
      return bucketCreation(s3, Bucket);
    }
    throw new Error(e);
  }
};

const ensureBucket = async (s3, name, debug) => {
  try {
    debug(`Checking if bucket ${name} exists.`);
    await s3.headBucket({ Bucket: name }).promise();
  } catch (e) {
    if (e.code === "NotFound") {
      debug(`Bucket ${name} does not exist. Creating...`);
      await s3.createBucket({ Bucket: name }).promise();
      // there's a race condition when using acceleration
      // so we need to sleep for a couple seconds. See this issue:
      // https://github.com/serverless/components/issues/428
      debug(`Bucket ${name} created. Confirming it's ready...`);
      await bucketCreation(s3, name);
      debug(`Bucket ${name} creation confirmed.`);
    } else if (e.code === "Forbidden" && e.message === null) {
      throw Error(
        `Forbidden: Invalid credentials or this AWS S3 bucket name may already be taken`
      );
    } else if (e.code === "Forbidden") {
      throw Error(`Bucket name "${name}" is already taken.`);
    } else {
      throw e;
    }
  }
};

const uploadDir = async (s3, bucketName, dirPath, cacheControl, options) => {
  const items: any = await new Promise((resolve, reject) => {
    try {
      resolve(klawSync(dirPath));
    } catch (error) {
      reject(error);
    }
  });

  const uploadItems = [];
  items.forEach((item) => {
    if (item.stats.isDirectory()) {
      return;
    }

    let key = path.relative(dirPath, item.path);

    if (options.keyPrefix) {
      key = path.posix.join(options.keyPrefix, key);
    }

    // convert backslashes to forward slashes on windows
    if (path.sep === "\\") {
      key = key.replace(/\\/g, "/");
    }

    const itemParams = {
      Bucket: bucketName,
      Key: key,
      Body: fs.readFileSync(item.path),
      ContentType:
        mime.lookup(path.basename(item.path)) || "application/octet-stream",
      CacheControl: cacheControl
    };

    uploadItems.push(s3.upload(itemParams).promise());
  });

  await Promise.all(uploadItems);
};

const packAndUploadDir = async ({
  s3,
  bucketName,
  dirPath,
  key,
  append = [],
  cacheControl
}) => {
  const ignore =
    (await utils.readFileIfExists(path.join(dirPath, ".slsignore"))) || [];
  return new Promise<void>((resolve, reject) => {
    const archive = archiver.create("zip", {
      zlib: { level: 9 }
    });

    if (!isEmpty(append)) {
      append.forEach((file) => {
        const fileStream = createReadStream(file);
        archive.append(fileStream, { name: path.basename(file) });
      });
    }

    archive.glob(
      "**/*",
      {
        cwd: dirPath,
        ignore
      },
      {}
    );

    archive
      .pipe(
        UploadStream(s3, {
          Bucket: bucketName,
          Key: key,
          CacheControl: cacheControl
        })
      )
      .on("error", function (err) {
        return reject(err);
      })
      .on("finish", function () {
        return resolve();
      });

    archive.finalize();
  });
};

const uploadFile = async ({
  s3,
  bucketName,
  filePath,
  key,
  cacheControl
}): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(
        UploadStream(s3, {
          Bucket: bucketName,
          Key: key,
          ContentType: mime.lookup(filePath) || "application/octet-stream",
          CacheControl: cacheControl
        })
      )
      .on("error", function (err) {
        return reject(err);
      })
      .on("finish", function () {
        return resolve();
      });
  });
};

/*
 * Delete Website Bucket
 */

const clearBucket = async (s3, bucketName) => {
  try {
    const data = await s3.listObjects({ Bucket: bucketName }).promise();

    const items = data.Contents;
    const promises = [];

    for (let i = 0; i < items.length; i += 1) {
      const deleteParams = { Bucket: bucketName, Key: items[i].Key };
      const delObj = s3.deleteObject(deleteParams).promise();
      promises.push(delObj);
    }

    await Promise.all(promises);
  } catch (error) {
    if (error.code !== "NoSuchBucket") {
      throw error;
    }
  }
};

const accelerateBucket = async (s3, bucketName, accelerated) => {
  try {
    await s3
      .putBucketAccelerateConfiguration({
        AccelerateConfiguration: {
          Status: accelerated ? "Enabled" : "Suspended"
        },
        Bucket: bucketName
      })
      .promise();
  } catch (e) {
    if (e.code === "NoSuchBucket") {
      await utils.sleep(2000);
      return accelerateBucket(s3, bucketName, accelerated);
    }
    throw e;
  }
};

const deleteBucket = async (s3, bucketName) => {
  try {
    await s3.deleteBucket({ Bucket: bucketName }).promise();
  } catch (error) {
    if (error.code !== "NoSuchBucket") {
      throw error;
    }
  }
};

const configureCors = async (s3, bucketName, config) => {
  const params = { Bucket: bucketName, CORSConfiguration: config };
  try {
    await s3.putBucketCors(params).promise();
  } catch (e) {
    if (e.code === "NoSuchBucket") {
      await utils.sleep(2000);
      return configureCors(s3, bucketName, config);
    }
    throw e;
  }
};

const configureBucketTags = async (s3, bucketName, configTags) => {
  const currentTags = {};

  try {
    const data = await s3.getBucketTagging({ Bucket: bucketName }).promise();
    data.TagSet.forEach((x) => {
      currentTags[x.Key] = x.Value;
    });
  } catch (error) {
    if (error.code === "NoSuchTagSet") {
      // Don't throw when there are no tags yet
    } else {
      throw error;
    }
  }

  if (!_.isEqual(configTags, currentTags)) {
    await s3.deleteBucketTagging({ Bucket: bucketName }).promise();

    const newTagSet = [];
    for (const [key, value] of Object.entries(configTags)) {
      newTagSet.push({ Key: key, Value: value });
    }

    await s3
      .putBucketTagging({
        Bucket: bucketName,
        Tagging: {
          TagSet: newTagSet
        }
      })
      .promise();
  }
};

export {
  getClients,
  uploadDir,
  packAndUploadDir,
  uploadFile,
  clearBucket,
  accelerateBucket,
  deleteBucket,
  bucketCreation,
  ensureBucket,
  configureCors,
  configureBucketTags
};
