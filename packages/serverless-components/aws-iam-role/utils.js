const { utils } = require("@serverless/core");
const { equals, isEmpty, has, not, pick, type } = require("ramda");

const addRolePolicy = async ({ iam, name, policy }) => {
  if (has("arn", policy)) {
    await iam
      .attachRolePolicy({
        RoleName: name,
        PolicyArn: policy.arn
      })
      .promise();
  } else if (!isEmpty(policy)) {
    await iam
      .putRolePolicy({
        RoleName: name,
        PolicyName: `${name}-policy`,
        PolicyDocument: JSON.stringify(policy)
      })
      .promise();
  }

  return utils.sleep(15000);
};

const removeRolePolicy = async ({ iam, name, policy }) => {
  if (has("arn", policy)) {
    await iam
      .detachRolePolicy({
        RoleName: name,
        PolicyArn: policy.arn
      })
      .promise();
  } else if (!isEmpty(policy)) {
    await iam
      .deleteRolePolicy({
        RoleName: name,
        PolicyName: `${name}-policy`
      })
      .promise();
  }
};

const createRole = async ({ iam, name, service, policy }) => {
  const assumeRolePolicyDocument = {
    Version: "2012-10-17",
    Statement: {
      Effect: "Allow",
      Principal: {
        Service: service
      },
      Action: "sts:AssumeRole"
    }
  };
  const roleRes = await iam
    .createRole({
      RoleName: name,
      Path: "/",
      AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument)
    })
    .promise();

  await addRolePolicy({
    iam,
    name,
    policy
  });

  return roleRes.Role.Arn;
};

const deleteRole = async ({ iam, name, policy }) => {
  try {
    await removeRolePolicy({
      iam,
      name,
      policy
    });
    await iam
      .deleteRole({
        RoleName: name
      })
      .promise();
  } catch (error) {
    if (
      error.message !== `Policy ${policy.arn} was not found.` &&
      error.code !== "NoSuchEntity"
    ) {
      throw error;
    }
  }
};

const getRole = async ({ iam, name }) => {
  try {
    const res = await iam.getRole({ RoleName: name }).promise();
    // todo add policy
    return {
      name: res.Role.RoleName,
      arn: res.Role.Arn,
      service: JSON.parse(decodeURIComponent(res.Role.AssumeRolePolicyDocument))
        .Statement[0].Principal.Service
    };
  } catch (e) {
    if (e.message.includes("cannot be found")) {
      return null;
    }
    throw e;
  }
};

const updateAssumeRolePolicy = async ({ iam, name, service }) => {
  const assumeRolePolicyDocument = {
    Version: "2012-10-17",
    Statement: {
      Effect: "Allow",
      Principal: {
        Service: service
      },
      Action: "sts:AssumeRole"
    }
  };
  await iam
    .updateAssumeRolePolicy({
      RoleName: name,
      PolicyDocument: JSON.stringify(assumeRolePolicyDocument)
    })
    .promise();
};

const inputsChanged = (prevRole, role) => {
  // todo add name and policy
  const inputs = pick(["service", "policy"], role);
  const prevInputs = pick(["service", "policy"], prevRole);

  if (type(inputs.service) === "Array") {
    inputs.service.sort();
  }
  if (type(prevInputs.service) === "Array") {
    prevInputs.service.sort();
  }

  return not(equals(inputs, prevInputs));
};

module.exports = {
  createRole,
  deleteRole,
  getRole,
  addRolePolicy,
  removeRolePolicy,
  updateAssumeRolePolicy,
  inputsChanged
};
