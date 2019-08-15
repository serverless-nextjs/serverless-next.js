const fse = require("fs-extra");
const path = require("path");
const mime = require("mime");

function notFound(reason) {
  return {
    statusCode: 404,
    headers: {
      "X-Serverless-Error": reason
    }
  };
}

const serveFile = async (nextDir, root, event) => {
  const assetPath = path.resolve(
    nextDir,
    "..",
    root,
    event.pathParameters.proxy
  );

  if (!(await fse.pathExists(assetPath))) {
    return notFound(`Unable to find file "${assetPath}".`);
  }

  try {
    const buffer = await fse.readFile(assetPath);
    return {
      statusCode: 200,
      body: buffer.toString("base64"),
      isBase64Encoded: true,
      headers: {
        "Content-Type": mime.getType(assetPath)
      }
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: {
        "X-Serverless-Error": JSON.stringify(e, Object.getOwnPropertyNames(e))
      }
    };
  }
};

module.exports = serveFile;
