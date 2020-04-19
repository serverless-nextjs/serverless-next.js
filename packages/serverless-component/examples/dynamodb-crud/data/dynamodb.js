const TableName = "Todos";

const getDynamoDBClient = () => {
  // important to require the sdk here rather than a top level import
  // this is to prevent the app from requiring the aws-sdk client side.
  const AWS = require("aws-sdk");

  // dynamodb is replicated across us-west-2 and eu-west-2
  // use us-west-2 for us regions or eu-west-2 for eu regions
  // you can tweak this to suit your needs
  const edgeRegion = process.env.AWS_REGION || "us-west-2";
  const dynamoDbRegion = edgeRegion.startsWith("us")
    ? "us-west-2"
    : "eu-west-2";

  const options = {
    convertEmptyValues: true,
    region: dynamoDbRegion
  };

  const client = process.env.LOCAL_DYNAMO_DB_ENDPOINT
    ? new AWS.DynamoDB.DocumentClient({
        ...options,
        endpoint: process.env.LOCAL_DYNAMO_DB_ENDPOINT
      })
    : new AWS.DynamoDB.DocumentClient(options);

  return client;
};

module.exports = {
  readTodos: async () => {
    const { Items } = await getDynamoDBClient()
      .scan({
        TableName
      })
      .promise();

    return Items;
  },
  getTodo: async todoId => {
    const { Items } = await getDynamoDBClient()
      .scan({
        TableName
      })
      .promise();

    const todo = Items.find(todo => todo.todoId == todoId);

    return todo;
  },
  createTodo: async todoDescription => {
    await getDynamoDBClient()
      .put({
        TableName,
        Item: {
          todoId: Date.now(),
          todoDescription
        }
      })
      .promise();
  }
};
