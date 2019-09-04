var AWS = require("aws-sdk");

require("dotenv").config();

AWS.config.update({
  region: "us-west-2",
  endpoint: process.env.LOCAL_DYNAMO_DB_ENDPOINT
});

var dynamodb = new AWS.DynamoDB();

var params = {
  TableName: "Todos",
  KeySchema: [
    { AttributeName: "todoId", KeyType: "HASH" } // Partition key
  ],
  AttributeDefinitions: [{ AttributeName: "todoId", AttributeType: "N" }],
  ProvisionedThroughput: {
    ReadCapacityUnits: 10,
    WriteCapacityUnits: 10
  }
};

dynamodb.createTable(params, function(err, data) {
  if (err) {
    console.error(
      "Unable to create table. Error JSON:",
      JSON.stringify(err, null, 2)
    );
  } else {
    console.log(
      "Created table. Table description JSON:",
      JSON.stringify(data, null, 2)
    );
  }
});
