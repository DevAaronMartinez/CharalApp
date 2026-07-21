const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const USERS_TABLE = process.env.USERS_TABLE;
const POSTS_TABLE = process.env.POSTS_TABLE;

function useDynamo() {
  return Boolean(USERS_TABLE && POSTS_TABLE);
}

module.exports = {
  docClient,
  USERS_TABLE,
  POSTS_TABLE,
  useDynamo,
};
