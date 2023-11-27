import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = "team17-registry"

//TODO: Update score, Update S3 bucket
export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const metadata = JSON.parse(JSON.stringify(event)).metadata;
  const data = JSON.parse(JSON.stringify(event)).data;

  const getCommand = new GetCommand({
    TableName: TableName,
    Key: {
      "ID": metadata.ID,
    },
  });

  const updateCommand = new UpdateCommand({
    TableName: TableName,
    Key: {
      "ID": metadata.ID,
    },
    UpdateExpression: "set Version = :Version, Content = :Content",
    ExpressionAttributeValues: {
      ':Version': metadata.Version,
      ':Content': data.Content
    },
  });
  
  try {
    const result = await docClient.send(getCommand);
    console.log(result.Item);
    if (result.Item) {
      // Update the item
      await docClient.send(updateCommand);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Version is updated' }),
      };
    } else {
      console.log('Package does not exist');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Package does not exist' }),
      };
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.' }),
    };
  }
}
